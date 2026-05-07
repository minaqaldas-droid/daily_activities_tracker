import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

type SignupPayload = {
  user?: {
    id?: string
    email?: string
    name?: string
  }
}

type UserRow = {
  id: string
  email: string
  name: string
  role: string | null
  is_approved: boolean | null
  created_at: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function formatDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date()
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function buildHtmlEmail(user: UserRow) {
  const approvalStatus = user.is_approved === false ? 'Pending approval' : 'Approved'

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
        <main style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <header style="padding:20px 24px;background:#0f766e;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;">New User Signup</h1>
            <p style="margin:8px 0 0;">A new user created an account in Daily Activities Tracker.</p>
          </header>
          <section style="padding:22px 24px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tbody>
                ${[
                  ['Name', user.name],
                  ['Email', user.email],
                  ['User ID', user.id],
                  ['Role', user.role || 'viewer'],
                  ['Approval Status', approvalStatus],
                  ['Signed Up At', `${formatDateTime(user.created_at)} Cairo`],
                ]
                  .map(
                    ([label, value]) => `
                      <tr>
                        <th style="text-align:left;width:170px;padding:10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">${escapeHtml(label)}</th>
                        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td>
                      </tr>
                    `
                  )
                  .join('')}
              </tbody>
            </table>
            <p style="margin:18px 0 0;color:#475569;">Open User Management in the app to approve, assign teams, or change the user's role.</p>
          </section>
        </main>
      </body>
    </html>
  `
}

function buildTextEmail(user: UserRow) {
  return [
    'New User Signup',
    '',
    `Name: ${user.name}`,
    `Email: ${user.email}`,
    `User ID: ${user.id}`,
    `Role: ${user.role || 'viewer'}`,
    `Approval Status: ${user.is_approved === false ? 'Pending approval' : 'Approved'}`,
    `Signed Up At: ${formatDateTime(user.created_at)} Cairo`,
    '',
    "Open User Management in the app to approve, assign teams, or change the user's role.",
  ].join('\n')
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

    const body = (await request.json().catch(() => ({}))) as SignupPayload
    const payloadUser = body.user || {}
    const userId = String(payloadUser.id || '').trim()
    const payloadEmail = String(payloadUser.email || '').trim().toLowerCase()

    if (!userId && !payloadEmail) {
      return new Response(JSON.stringify({ error: 'Missing signed-up user details.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const brevoApiKey = getRequiredEnv('BREVO_API_KEY')
    const emailFrom = Deno.env.get('SIGNUP_NOTIFICATION_EMAIL_FROM')?.trim() || getRequiredEnv('DAILY_ACTIVITY_EMAIL_FROM')
    const emailReplyTo = Deno.env.get('SIGNUP_NOTIFICATION_EMAIL_REPLY_TO')?.trim() || Deno.env.get('DAILY_ACTIVITY_EMAIL_REPLY_TO')?.trim()

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    })

    let query = supabase
      .from('users')
      .select('id,email,name,role,is_approved,created_at')
      .limit(1)

    query = userId ? query.eq('id', userId) : query.eq('email', payloadEmail)

    const { data: users, error: userError } = await query
    if (userError) {
      throw userError
    }

    const user = ((users || [])[0] as UserRow | undefined) || {
      id: userId,
      email: payloadEmail,
      name: String(payloadUser.name || payloadEmail.split('@')[0] || 'New User').trim(),
      role: 'viewer',
      is_approved: false,
      created_at: new Date().toISOString(),
    }

    const { data: superAdminRows, error: superAdminError } = await supabase.from('super_admins').select('user_id')
    if (superAdminError) {
      throw superAdminError
    }

    const superAdminIds = ((superAdminRows || []) as Array<{ user_id: string }>).map((row) => row.user_id).filter(Boolean)
    if (superAdminIds.length === 0) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no_superadmins' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: superAdmins, error: superAdminUsersError } = await supabase
      .from('users')
      .select('email,is_approved')
      .in('id', superAdminIds)

    if (superAdminUsersError) {
      throw superAdminUsersError
    }

    const recipients = Array.from(
      new Set(
        ((superAdmins || []) as Array<{ email: string; is_approved: boolean | null }>)
          .filter((admin) => admin.email && admin.is_approved !== false)
          .map((admin) => admin.email.trim())
          .filter(Boolean)
      )
    )

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no_superadmin_emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const providerMessageId = await sendBrevoEmail({
      apiKey: brevoApiKey,
      from: emailFrom,
      replyTo: emailReplyTo,
      recipients,
      subject: `New user signup - ${user.name}`,
      html: buildHtmlEmail(user),
      text: buildTextEmail(user),
    })

    return new Response(
      JSON.stringify({
        status: 'sent',
        recipientCount: recipients.length,
        providerMessageId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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
