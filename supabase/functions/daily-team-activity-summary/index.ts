import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

type TeamRow = {
  id: string
  name: string
}

type TeamSettingsRow = {
  daily_activity_email_enabled: boolean | null
  daily_activity_email_time: string | null
  show_moc_activity: boolean | null
  activity_field_definitions: unknown
  activity_field_config: unknown
}

type TeamWithSettingsRow = TeamRow & {
  team_settings?: TeamSettingsRow | TeamSettingsRow[] | null
}

type ActivityRow = {
  date: string
  performer: string
  system: string
  shift: string
  permit_number: string
  instrument_type: string
  activityType: string
  tag: string
  problem: string
  action: string
  comments: string
  custom_fields: Record<string, string> | null
  created_at: string
}

type ActivityFieldDefinition = {
  key: string
  label: string
  type: 'text' | 'select' | 'textarea' | 'date' | 'checkbox'
  defaultEnabled: boolean
  defaultOrder: number
  isCustom?: boolean
}

type StoredActivityFieldDefinition = {
  key: string
  label: string
  type: 'text' | 'select' | 'textarea' | 'date' | 'checkbox'
  archived?: boolean
}

type ActivityFieldConfig = Record<string, { enabled: boolean; order: number }>

type MembershipRow = {
  users: {
    email: string
    name: string
    is_approved: boolean | null
  } | null
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  PM: 'PM (Preventive Maintenance)',
  CM: 'CM (Corrective Maintenance)',
  Mod: 'Mod (Modification)',
  'SD Activity': 'SD Activity',
}

const BASE_ACTIVITY_FIELD_DEFINITIONS: ActivityFieldDefinition[] = [
  { key: 'date', label: 'Date', type: 'date', defaultEnabled: true, defaultOrder: 10 },
  { key: 'performer', label: 'Performer', type: 'text', defaultEnabled: true, defaultOrder: 20 },
  { key: 'system', label: 'System', type: 'select', defaultEnabled: true, defaultOrder: 30 },
  { key: 'shift', label: 'Shift', type: 'select', defaultEnabled: false, defaultOrder: 40 },
  { key: 'permitNumber', label: 'Permit Number', type: 'text', defaultEnabled: false, defaultOrder: 50 },
  { key: 'instrumentType', label: 'Instrument Type', type: 'text', defaultEnabled: false, defaultOrder: 60 },
  { key: 'activityType', label: 'Activity Type', type: 'select', defaultEnabled: true, defaultOrder: 70 },
  { key: 'mocActivity', label: 'MOC', type: 'checkbox', defaultEnabled: true, defaultOrder: 75 },
  { key: 'tag', label: 'Tag', type: 'text', defaultEnabled: true, defaultOrder: 80 },
  { key: 'problem', label: 'Problem', type: 'textarea', defaultEnabled: true, defaultOrder: 90 },
  { key: 'action', label: 'Action Taken', type: 'textarea', defaultEnabled: true, defaultOrder: 100 },
  { key: 'comments', label: 'Comments', type: 'textarea', defaultEnabled: true, defaultOrder: 110 },
]

const BASE_ACTIVITY_FIELD_KEYS = new Set(BASE_ACTIVITY_FIELD_DEFINITIONS.map((field) => field.key))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDisplayDate(value: string) {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return value
  }

  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))

  return `${String(day).padStart(2, '0')}-${monthName}-${year}`
}

function normalizeFieldKey(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((segment, index) =>
      index === 0 ? segment.charAt(0).toLowerCase() + segment.slice(1) : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join('')

  return normalized
}

function normalizeStoredActivityFieldDefinitions(value: unknown): StoredActivityFieldDefinition[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seenKeys = new Set<string>()
  const fields: StoredActivityFieldDefinition[] = []

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const raw = item as Partial<StoredActivityFieldDefinition>
    const key = normalizeFieldKey(String(raw.key || raw.label || ''))
    const label = String(raw.label || '').trim()
    const type = raw.type

    if (!key || !label || !type || !['text', 'select', 'textarea', 'date', 'checkbox'].includes(type) || seenKeys.has(key)) {
      return
    }

    seenKeys.add(key)
    fields.push({
      key,
      label,
      type,
      archived: Boolean(raw.archived),
    })
  })

  return fields
}

function hasExplicitActivityFieldSelection(definitions: StoredActivityFieldDefinition[]) {
  if (definitions.length === 0) {
    return false
  }

  const storedKeys = new Set(definitions.map((definition) => definition.key))
  return BASE_ACTIVITY_FIELD_DEFINITIONS.every((field) => storedKeys.has(field.key))
}

function getActivityFieldDefinitions(settings?: TeamSettingsRow | null) {
  const storedDefinitions = normalizeStoredActivityFieldDefinitions(settings?.activity_field_definitions)
  const explicitFieldSelection = hasExplicitActivityFieldSelection(storedDefinitions)
  const overridesByKey = new Map(storedDefinitions.map((definition) => [definition.key, definition]))
  const customFieldStartOrder = BASE_ACTIVITY_FIELD_DEFINITIONS.length * 10 + 10

  if (explicitFieldSelection) {
    let customIndex = 0
    return storedDefinitions
      .filter((field) => !field.archived)
      .map((field) => {
        const baseDefinition = BASE_ACTIVITY_FIELD_DEFINITIONS.find((baseField) => baseField.key === field.key)
        if (baseDefinition) {
          return {
            ...baseDefinition,
            label: field.label || baseDefinition.label,
            type: field.key === 'performer' ? 'text' : field.type || baseDefinition.type,
          }
        }

        const normalizedField: ActivityFieldDefinition = {
          key: field.key,
          label: field.label,
          type: field.type,
          defaultEnabled: true,
          defaultOrder: customFieldStartOrder + customIndex * 10,
          isCustom: true,
        }
        customIndex += 1
        return normalizedField
      })
  }

  const baseDefinitions = BASE_ACTIVITY_FIELD_DEFINITIONS.flatMap((field) => {
    const override = overridesByKey.get(field.key)
    if (override?.archived) {
      return []
    }

    return [
      {
        ...field,
        label: override?.label || field.label,
        type: field.key === 'performer' ? 'text' : override?.type || field.type,
      },
    ]
  })

  const customDefinitions = storedDefinitions
    .filter((field) => !BASE_ACTIVITY_FIELD_KEYS.has(field.key) && !field.archived)
    .map((field, index): ActivityFieldDefinition => ({
      key: field.key,
      label: field.label,
      type: field.type,
      defaultEnabled: true,
      defaultOrder: customFieldStartOrder + index * 10,
      isCustom: true,
    }))

  return [...baseDefinitions, ...customDefinitions]
}

function getActivityFieldConfig(settings: TeamSettingsRow | null | undefined, definitions: ActivityFieldDefinition[]) {
  const raw = settings?.activity_field_config && typeof settings.activity_field_config === 'object'
    ? (settings.activity_field_config as Partial<Record<string, Partial<{ enabled: boolean; order: number }>>>)
    : {}

  const config = definitions.reduce<ActivityFieldConfig>((accumulator, field) => {
    const rawField = raw[field.key]
    accumulator[field.key] = {
      enabled: typeof rawField?.enabled === 'boolean' ? rawField.enabled : field.defaultEnabled,
      order: Number.isFinite(Number(rawField?.order)) ? Number(rawField?.order) : field.defaultOrder,
    }
    return accumulator
  }, {})

  if (definitions.some((field) => field.key === 'mocActivity') && !raw.mocActivity && typeof settings?.show_moc_activity === 'boolean') {
    config.mocActivity = {
      ...config.mocActivity,
      enabled: settings.show_moc_activity,
    }
  }

  return config
}

function getEnabledActivityFields(settings?: TeamSettingsRow | null) {
  const definitions = getActivityFieldDefinitions(settings)
  const config = getActivityFieldConfig(settings, definitions)

  return [...definitions]
    .filter((field) => config[field.key]?.enabled)
    .sort((first, second) => {
      const firstOrder = config[first.key]?.order ?? first.defaultOrder
      const secondOrder = config[second.key]?.order ?? second.defaultOrder

      if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder
      }

      return first.defaultOrder - second.defaultOrder
    })
}

function getCairoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
    isoDate: `${byType.year}-${byType.month}-${byType.day}`,
  }
}

function getCairoClockMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = Number(byType.hour === '24' ? '0' : byType.hour)
  const minute = Number(byType.minute)

  return hour * 60 + minute
}

function parseDailyEmailTime(value: string | null | undefined) {
  const normalized = typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '17:00'
  const [hour, minute] = normalized.split(':').map(Number)
  return {
    value: normalized,
    minutes: hour * 60 + minute,
  }
}

function getTeamSettings(team: TeamWithSettingsRow) {
  if (Array.isArray(team.team_settings)) {
    return team.team_settings[0] || null
  }

  return team.team_settings || null
}

function getTimeZoneDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour === '24' ? '0' : byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  }
}

function getUtcInstantForTimeZoneDateTime(
  timeZone: string,
  dateTime: { year: number; month: number; day: number; hour: number; minute: number; second: number }
) {
  let utc = Date.UTC(dateTime.year, dateTime.month - 1, dateTime.day, dateTime.hour, dateTime.minute, dateTime.second)

  for (let index = 0; index < 3; index += 1) {
    const actual = getTimeZoneDateTimeParts(new Date(utc), timeZone)
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
    const expectedAsUtc = Date.UTC(dateTime.year, dateTime.month - 1, dateTime.day, dateTime.hour, dateTime.minute, dateTime.second)
    utc -= actualAsUtc - expectedAsUtc
  }

  return new Date(utc)
}

function getCairoDayUtcRange(summaryDate: string) {
  const [year, month, day] = summaryDate.split('-').map(Number)
  const start = getUtcInstantForTimeZoneDateTime('Africa/Cairo', {
    year,
    month,
    day,
    hour: 0,
    minute: 0,
    second: 0,
  })
  const end = getUtcInstantForTimeZoneDateTime('Africa/Cairo', {
    year,
    month,
    day: day + 1,
    hour: 0,
    minute: 0,
    second: 0,
  })

  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
  }
}

function getActivityTypeLabel(value: string) {
  return ACTIVITY_TYPE_LABELS[value] || value || 'Unspecified'
}

function buildCustomFieldsText(customFields: Record<string, string> | null) {
  const entries = Object.entries(customFields || {}).filter(([, value]) => String(value || '').trim())
  if (entries.length === 0) {
    return ''
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join('; ')
}

function getActivityFieldValue(activity: ActivityRow, field: ActivityFieldDefinition) {
  switch (field.key) {
    case 'date':
      return formatDisplayDate(activity.date)
    case 'performer':
      return activity.performer
    case 'system':
      return activity.system
    case 'shift':
      return activity.shift
    case 'permitNumber':
      return activity.permit_number
    case 'instrumentType':
      return activity.instrument_type
    case 'activityType':
      return getActivityTypeLabel(activity.activityType)
    case 'tag':
      return activity.tag
    case 'problem':
      return activity.problem
    case 'action':
      return activity.action
    case 'comments':
      return activity.comments
    case 'mocActivity':
      return String(activity.custom_fields?.mocActivity || '').toLowerCase() === 'true' || activity.comments.toLowerCase().includes('{moc}')
        ? 'Yes'
        : ''
    default: {
      const rawValue = activity.custom_fields?.[field.key] || ''
      if (field.type === 'checkbox') {
        return String(rawValue).toLowerCase() === 'true' ? 'Yes' : ''
      }

      if (field.type === 'date') {
        return formatDisplayDate(String(rawValue))
      }

      return rawValue
    }
  }
}

function buildHtmlEmail(team: TeamRow, summaryDate: string, activities: ActivityRow[], fields: ActivityFieldDefinition[]) {
  const displaySummaryDate = formatDisplayDate(summaryDate)
  const rows = activities
    .map((activity) => {
      return `
        <tr>
          ${fields.map((field) => `<td>${escapeHtml(getActivityFieldValue(activity, field))}</td>`).join('')}
        </tr>
      `
    })
    .join('')

  const emptyState = activities.length === 0 ? '<p>No activities were added for this team today.</p>' : ''

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
        <main style="max-width:1200px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <header style="padding:20px 24px;background:#1d4ed8;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;">Daily Activities Summary</h1>
            <p style="margin:8px 0 0;">${escapeHtml(team.name)} - ${escapeHtml(displaySummaryDate)}</p>
          </header>
          <section style="padding:20px 24px;">
            <p style="margin:0 0 16px;"><strong>Total activities:</strong> ${activities.length}</p>
            ${emptyState}
            ${
              activities.length > 0
                ? `
                  <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                      <thead>
                        <tr>
                          ${fields
                            .map((field) => `<th style="text-align:left;padding:10px;border-bottom:2px solid #cbd5e1;background:#f1f5f9;">${escapeHtml(field.label)}</th>`)
                            .join('')}
                        </tr>
                      </thead>
                      <tbody>
                        ${rows}
                      </tbody>
                    </table>
                  </div>
                `
                : ''
            }
          </section>
        </main>
      </body>
    </html>
  `
}

function buildTextEmail(team: TeamRow, summaryDate: string, activities: ActivityRow[], fields: ActivityFieldDefinition[]) {
  const lines = [
    'Daily Activities Summary',
    `${team.name} - ${formatDisplayDate(summaryDate)}`,
    `Total activities: ${activities.length}`,
    '',
  ]

  if (activities.length === 0) {
    lines.push('No activities were added for this team today.')
    return lines.join('\n')
  }

  activities.forEach((activity, index) => {
    lines.push(`${index + 1}. ${activity.tag || 'No tag'} - ${getActivityTypeLabel(activity.activityType)}`)
    fields.forEach((field) => {
      lines.push(`   ${field.label}: ${getActivityFieldValue(activity, field)}`)
    })
    lines.push('')
  })

  return lines.join('\n')
}

function parseEmailIdentity(value: string) {
  const match = value.match(/^(.*?)\s*<([^<>]+)>$/)
  if (!match) {
    return {
      email: value.trim(),
    }
  }

  return {
    name: match[1].trim() || undefined,
    email: match[2].trim(),
  }
}

async function sendBrevoEmail(input: {
  apiKey: string
  from: string
  replyTo?: string
  recipients: string[]
  subject: string
  html: string
  text: string
}) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': input.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: parseEmailIdentity(input.from),
      bcc: input.recipients.map((email) => ({ email })),
      replyTo: input.replyTo ? parseEmailIdentity(input.replyTo) : undefined,
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Brevo request failed with HTTP ${response.status}`)
  }

  return String(body?.messageId || body?.id || '')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cronSecret = Deno.env.get('DAILY_ACTIVITY_EMAIL_CRON_SECRET')?.trim()
    if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody = await request.json().catch(() => ({}))
    const forceSend = requestBody?.force === true

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const brevoApiKey = getRequiredEnv('BREVO_API_KEY')
    const emailFrom = getRequiredEnv('DAILY_ACTIVITY_EMAIL_FROM')
    const emailReplyTo = Deno.env.get('DAILY_ACTIVITY_EMAIL_REPLY_TO')?.trim()
    const sendEmptySummaries = Deno.env.get('DAILY_ACTIVITY_EMAIL_SEND_EMPTY')?.trim().toLowerCase() === 'true'

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    const now = new Date()
    const { isoDate: summaryDate } = getCairoDateParts(now)
    const currentCairoMinutes = getCairoClockMinutes(now)
    const { startUtc, endUtc } = getCairoDayUtcRange(summaryDate)
    const { data: teams, error: teamsError } = await supabase
      .from('app_teams')
      .select(
        'id,name,team_settings!inner(daily_activity_email_enabled,daily_activity_email_time,show_moc_activity,activity_field_definitions,activity_field_config)'
      )
      .eq('is_active', true)
      .eq('team_settings.daily_activity_email_enabled', true)
      .order('name', { ascending: true })

    if (teamsError) {
      throw teamsError
    }

    const results = []

    for (const team of (teams || []) as TeamWithSettingsRow[]) {
      const teamSettings = getTeamSettings(team)
      const scheduledTime = parseDailyEmailTime(teamSettings?.daily_activity_email_time)

      if (!forceSend && currentCairoMinutes < scheduledTime.minutes) {
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'skipped',
          reason: 'not_due',
          scheduledTime: scheduledTime.value,
        })
        continue
      }

      const { data: sentLog, error: sentLogError } = await supabase
        .from('daily_activity_email_logs')
        .select('id')
        .eq('team_id', team.id)
        .eq('summary_date', summaryDate)
        .eq('status', 'sent')
        .maybeSingle()

      if (sentLogError) {
        throw sentLogError
      }

      if (sentLog) {
        results.push({ teamId: team.id, teamName: team.name, status: 'skipped', reason: 'already_sent' })
        continue
      }

      const { data: activities, error: activitiesError } = await supabase
        .from('team_activities')
        .select('date,performer,system,shift,permit_number,instrument_type,activityType,tag,problem,action,comments,custom_fields,created_at')
        .eq('team_id', team.id)
        .gte('created_at', startUtc)
        .lt('created_at', endUtc)
        .order('created_at', { ascending: true })

      if (activitiesError) {
        throw activitiesError
      }

      const activityRows = (activities || []) as ActivityRow[]
      if (activityRows.length === 0 && !sendEmptySummaries) {
        await supabase.from('daily_activity_email_logs').insert({
          team_id: team.id,
          summary_date: summaryDate,
          status: 'skipped',
          recipient_count: 0,
          activity_count: 0,
          error_message: 'No activities for summary date.',
        })
        results.push({ teamId: team.id, teamName: team.name, status: 'skipped', reason: 'no_activities' })
        continue
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('team_memberships')
        .select('users(email,name,is_approved)')
        .eq('team_id', team.id)

      if (membershipsError) {
        throw membershipsError
      }

      const recipients = Array.from(
        new Set(
          ((memberships || []) as MembershipRow[])
            .map((membership) => membership.users)
            .filter((user): user is NonNullable<MembershipRow['users']> => Boolean(user?.email && user.is_approved !== false))
            .map((user) => user.email.trim())
            .filter(Boolean)
        )
      )

      if (recipients.length === 0) {
        await supabase.from('daily_activity_email_logs').insert({
          team_id: team.id,
          summary_date: summaryDate,
          status: 'skipped',
          recipient_count: 0,
          activity_count: activityRows.length,
          error_message: 'No approved team users with email addresses.',
        })
        results.push({ teamId: team.id, teamName: team.name, status: 'skipped', reason: 'no_recipients' })
        continue
      }

      try {
        const emailFields = getEnabledActivityFields(teamSettings)
        const providerMessageId = await sendBrevoEmail({
          apiKey: brevoApiKey,
          from: emailFrom,
          replyTo: emailReplyTo,
          recipients,
          subject: `Daily Activities Summary - ${team.name} - ${formatDisplayDate(summaryDate)}`,
          html: buildHtmlEmail(team, summaryDate, activityRows, emailFields),
          text: buildTextEmail(team, summaryDate, activityRows, emailFields),
        })

        await supabase.from('daily_activity_email_logs').insert({
          team_id: team.id,
          summary_date: summaryDate,
          status: 'sent',
          recipient_count: recipients.length,
          activity_count: activityRows.length,
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
        })

        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'sent',
          recipientCount: recipients.length,
          activityCount: activityRows.length,
        })
      } catch (error) {
        await supabase.from('daily_activity_email_logs').insert({
          team_id: team.id,
          summary_date: summaryDate,
          status: 'failed',
          recipient_count: recipients.length,
          activity_count: activityRows.length,
          error_message: error instanceof Error ? error.message : String(error),
        })
        results.push({
          teamId: team.id,
          teamName: team.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return new Response(JSON.stringify({ summaryDate, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
