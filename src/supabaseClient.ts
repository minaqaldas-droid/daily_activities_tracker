import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User as SupabaseAuthUser,
  type UserAttributes,
} from '@supabase/supabase-js'
import { type ActivityTypeValue, getActivityTypeLabel } from './constants/activityTypes'
import { type DashboardResultsFilter } from './types/activityResults'
import { formatDateForDisplay, normalizeDateForApp } from './utils/date'
import {
  DEFAULT_ACTIVITY_FIELD_CONFIG,
  DEFAULT_ACTIVITY_FIELD_DEFINITIONS,
  getCoreActivityFieldDefinitions,
  normalizeStoredActivityFieldDefinitions,
  type ActivityFieldConfig,
  type StoredActivityFieldDefinition,
} from './utils/activityFields'
import {
  DEFAULT_DASHBOARD_CHART_CONFIG,
  DEFAULT_DASHBOARD_CHART_DEFINITIONS,
  getCoreDashboardChartDefinitions,
  normalizeStoredDashboardChartDefinitions,
  type DashboardChartConfig,
  type StoredDashboardChartDefinition,
} from './utils/dashboardCharts'
import {
  DEFAULT_DASHBOARD_CARD_CONFIG,
  DEFAULT_DASHBOARD_CARD_DEFINITIONS,
  getCoreDashboardCardDefinitions,
  normalizeStoredDashboardCardDefinitions,
  type DashboardCardConfig,
  type StoredDashboardCardDefinition,
} from './utils/dashboardCards'
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig } from './utils/layoutConfig'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function assertSupabaseConfigured() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

assertSupabaseConfigured()

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export interface Activity {
  id?: string
  date: string
  performer: string
  system: string
  shift: string
  permitNumber: string
  instrumentType: string
  activityType: ActivityTypeValue | ''
  tag: string
  problem: string
  action: string
  comments: string
  customFields?: Record<string, string>
  editedBy?: string | null
  created_at?: string
  edited_at?: string | null
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface Team {
  id: string
  name: string
  slug: string
  is_active?: boolean
  created_at?: string
}

export interface TeamMembership {
  team: Team
  role: UserRole
  permissions: FeaturePermissions
  is_default: boolean
  created_at?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  is_superadmin?: boolean
  active_team?: Team
  team_memberships?: TeamMembership[]
  avatar_url?: string
  preferred_primary_color?: string
  permissions?: FeaturePermissions
  is_approved?: boolean
  approved_at?: string | null
  created_at?: string
}

export interface Settings {
  id?: string
  webapp_name: string
  logo_url: string
  browser_tab_name?: string
  favicon_url?: string
  primary_color?: string
  performer_mode?: 'manual' | 'auto'
  show_moc_activity?: boolean
  header_font_family?: string
  subheader_font_family?: string
  sidebar_font_family?: string
  activity_field_config?: ActivityFieldConfig
  activity_field_definitions?: StoredActivityFieldDefinition[]
  dashboard_chart_config?: DashboardChartConfig
  dashboard_chart_definitions?: StoredDashboardChartDefinition[]
  dashboard_card_config?: DashboardCardConfig
  dashboard_card_definitions?: StoredDashboardCardDefinition[]
  layout_config?: LayoutConfig
  updated_at?: string
  updated_by?: string
}

export interface SearchFilters {
  date?: string
  startDate?: string
  endDate?: string
  performer?: string
  activityType?: ActivityTypeValue | ''
  tag?: string
  system?: string
  shift?: string
  permitNumber?: string
  instrumentType?: string
  problem?: string
  action?: string
  comments?: string
  customFields?: Record<string, string | boolean>
  checkboxLabels?: Record<string, string>
  keyword?: string
  hasMoc?: boolean
}

export interface AuthActionResult {
  user?: User
  requiresEmailConfirmation: boolean
  message?: string
}

export interface UpdateUserDetailsInput {
  name: string
  email: string
  password?: string
  avatarUrl?: string
  preferredPrimaryColor?: string
}

export interface UpdateUserDetailsResult {
  user: User
  emailChangePending: boolean
  pendingEmail?: string
}

type UserProfileRow = {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer' | 'user' | 'superadmin' | null
  avatar_url?: string | null
  preferred_primary_color?: string | null
  permissions?: Partial<FeaturePermissions> | null
  is_approved?: boolean | null
  approved_at?: string | null
  created_at?: string
}

export type FeatureKey =
  | 'dashboard'
  | 'add'
  | 'edit'
  | 'search'
  | 'import'
  | 'export'
  | 'edit_action'
  | 'delete_action'

export type FeaturePermissions = Record<FeatureKey, boolean>

export interface AdminManagedUser {
  id: string
  email: string
  name: string
  role: UserRole
  permissions: FeaturePermissions
  is_approved: boolean
  approved_at?: string | null
  created_at?: string
}

interface UpdateManagedUserInput {
  email?: string
  name?: string
  role?: UserRole
  isApproved?: boolean
  teamId?: string
}

export interface ManagedTeam {
  id: string
  name: string
  slug: string
  is_active: boolean
  member_count: number
  created_at?: string
}

export interface ReusableEditorCatalogs {
  fields: StoredActivityFieldDefinition[]
  charts: StoredDashboardChartDefinition[]
  cards: StoredDashboardCardDefinition[]
}

export interface TeamManagedUser extends AdminManagedUser {
  team_ids: string[]
  team_roles: Record<string, UserRole>
}

let reusableEditorCatalogCache: { value: ReusableEditorCatalogs; expiresAt: number } | null = null

type TeamRow = {
  id: string
  name: string
  slug: string
  is_active?: boolean | null
  created_at?: string
}

type TeamMembershipRow = {
  team_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer' | null
  permissions?: Partial<FeaturePermissions> | null
  is_default?: boolean | null
  created_at?: string
  app_teams?: TeamRow | null
}

const DEFAULT_SETTINGS: Settings = {
  webapp_name: 'Daily Activities Tracker',
  logo_url: '',
  browser_tab_name: 'Daily Activities Tracker',
  favicon_url: '',
  primary_color: '#667eea',
  performer_mode: 'manual',
  show_moc_activity: true,
  header_font_family: '',
  subheader_font_family: '',
  sidebar_font_family: '',
  activity_field_config: DEFAULT_ACTIVITY_FIELD_CONFIG,
  activity_field_definitions: DEFAULT_ACTIVITY_FIELD_DEFINITIONS,
  dashboard_chart_config: DEFAULT_DASHBOARD_CHART_CONFIG,
  dashboard_chart_definitions: DEFAULT_DASHBOARD_CHART_DEFINITIONS,
  dashboard_card_config: DEFAULT_DASHBOARD_CARD_CONFIG,
  dashboard_card_definitions: DEFAULT_DASHBOARD_CARD_DEFINITIONS,
  layout_config: DEFAULT_LAYOUT_CONFIG,
}

function getArchivedCoreActivityFieldSettings(): StoredActivityFieldDefinition[] {
  return getCoreActivityFieldDefinitions().map((field) => ({
    key: field.key,
    label: field.label,
    placeholder: field.placeholder,
    type: field.type,
    options: field.options || [],
    searchable: field.searchable !== false,
    tableBadge: Boolean(field.tableBadge),
    archived: true,
  }))
}

function getArchivedCoreDashboardChartSettings(): StoredDashboardChartDefinition[] {
  return getCoreDashboardChartDefinitions().map((chart) => ({
    key: chart.key,
    label: chart.label,
    fieldKey: chart.fieldKey,
    chartType: chart.chartType,
    maxItems: chart.maxItems,
    includeEmpty: chart.includeEmpty,
    archived: true,
  }))
}

function getArchivedCoreDashboardCardSettings(): StoredDashboardCardDefinition[] {
  return getCoreDashboardCardDefinitions().map((card) => ({
    key: card.key,
    label: card.label,
    metric: card.metric,
    icon: card.icon,
    fieldKey: card.fieldKey,
    fieldValue: card.fieldValue,
    description: card.description,
    archived: true,
  }))
}

function getEmptyDynamicTeamSettings(teamName: string): Settings {
  return {
    ...DEFAULT_SETTINGS,
    webapp_name: `${teamName} Activities Tracker`,
    browser_tab_name: `${teamName} Activities`,
    show_moc_activity: false,
    activity_field_definitions: getArchivedCoreActivityFieldSettings(),
    activity_field_config: {},
    dashboard_chart_definitions: getArchivedCoreDashboardChartSettings(),
    dashboard_chart_config: {},
    dashboard_card_definitions: getArchivedCoreDashboardCardSettings(),
    dashboard_card_config: {},
  }
}

function isMissingColumnError(error: unknown, columnName: string) {
  const maybeError = error as { code?: string; message?: string } | undefined
  const message = maybeError?.message || ''

  return Boolean(
    maybeError?.code === '42703' ||
      maybeError?.code === 'PGRST204' ||
      message.toLowerCase().includes(columnName.toLowerCase())
  )
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error) {
    const maybeError = error as { message?: string; details?: string; hint?: string; code?: string }
    const segments = [maybeError.message, maybeError.details, maybeError.hint, maybeError.code].filter(Boolean)

    if (segments.length > 0) {
      return segments.join(' | ')
    }

    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

function getActivityWriteErrorMessage(error: unknown, action: 'create' | 'bulk create') {
  const baseMessage = getUnknownErrorMessage(error)
  const needsMigration =
    isMissingColumnError(error, 'shift') ||
    isMissingColumnError(error, 'permit_number') ||
    isMissingColumnError(error, 'instrument_type')

  if (needsMigration) {
    return `${action === 'create' ? 'Create activity' : 'Bulk create activities'} failed because the database schema is outdated. Run migration/MIGRATION_ACTIVITY_FIELD_CONFIG.sql in Supabase SQL Editor. ${baseMessage}`
  }

  return `${action === 'create' ? 'Create activity' : 'Bulk create activities'} failed: ${baseMessage}`
}

function requireActiveTeam(team?: Team | null) {
  if (!team?.id) {
    throw new Error('No active team is selected. Assign the user to a team and try again.')
  }

  return team
}

export const ADMIN_PERMISSIONS: FeaturePermissions = {
  dashboard: true,
  add: true,
  edit: true,
  search: true,
  import: true,
  export: true,
  edit_action: true,
  delete_action: true,
}

export const EDITOR_PERMISSIONS: FeaturePermissions = {
  dashboard: true,
  add: true,
  edit: true,
  search: true,
  import: false,
  export: true,
  edit_action: true,
  delete_action: true,
}

export const VIEWER_PERMISSIONS: FeaturePermissions = {
  dashboard: true,
  add: false,
  edit: false,
  search: true,
  import: false,
  export: true,
  edit_action: false,
  delete_action: false,
}

export const DEFAULT_USER_PERMISSIONS: FeaturePermissions = VIEWER_PERMISSIONS

export function normalizePermissions(
  _permissions: Partial<FeaturePermissions> | null | undefined,
  role: User['role']
): FeaturePermissions {
  if (role === 'admin') {
    return { ...ADMIN_PERMISSIONS }
  }

  if (role === 'editor') {
    return { ...EDITOR_PERMISSIONS }
  }

  return { ...VIEWER_PERMISSIONS }
}

export function hasPermission(user: User | null | undefined, feature: FeatureKey) {
  if (!user) {
    return false
  }

  if (user.is_superadmin) {
    return true
  }

  if (user.role === 'admin') {
    return true
  }

  const normalized = normalizePermissions(user.permissions, user.role)
  return Boolean(normalized[feature])
}

function normalizeUserRole(role: UserProfileRow['role'] | undefined): UserRole {
  if (role === 'admin' || role === 'superadmin') {
    return 'admin'
  }

  if (role === 'editor') {
    return 'editor'
  }

  return 'viewer'
}

function normalizeTeam(row: TeamRow | null | undefined): Team {
  if (!row) {
    return {
      id: '',
      name: 'Unknown Team',
      slug: 'unknown-team',
      is_active: false,
    }
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    is_active: row.is_active !== false,
    created_at: row.created_at,
  }
}

function normalizeTeamMembership(row: TeamMembershipRow): TeamMembership {
  const role = normalizeUserRole(row.role)

  return {
    team: normalizeTeam(row.app_teams),
    role,
    permissions: normalizePermissions(row.permissions, role),
    is_default: row.is_default === true,
    created_at: row.created_at,
  }
}

function getPreferredMembership(memberships: TeamMembership[]) {
  return memberships.find((membership) => membership.is_default) || memberships[0]
}

function getMetadataAvatar(authUser: SupabaseAuthUser) {
  const metadataAvatar =
    typeof authUser.user_metadata?.avatar_url === 'string'
      ? authUser.user_metadata.avatar_url.trim()
      : ''

  return metadataAvatar
}

function normalizeUserProfile(
  profile: UserProfileRow,
  avatarUrl?: string,
  access: { isSuperadmin?: boolean; memberships?: TeamMembership[] } = {}
): User {
  const preferredMembership = getPreferredMembership(access.memberships || [])
  const normalizedRole = access.isSuperadmin
    ? 'admin'
    : preferredMembership?.role || normalizeUserRole(profile.role)
  const normalizedAvatar = (avatarUrl || profile.avatar_url || '').trim()
  const normalizedPrimaryColor = (profile.preferred_primary_color || '').trim()
  const normalizedPermissions = access.isSuperadmin
    ? { ...ADMIN_PERMISSIONS }
    : preferredMembership?.permissions || normalizePermissions(profile.permissions, normalizedRole)
  const isApproved = profile.is_approved !== false

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: normalizedRole,
    is_superadmin: access.isSuperadmin === true,
    active_team: preferredMembership?.team,
    team_memberships: access.memberships || [],
    avatar_url: normalizedAvatar || undefined,
    preferred_primary_color: normalizedPrimaryColor || undefined,
    permissions: normalizedPermissions,
    is_approved: isApproved,
    approved_at: profile.approved_at ?? null,
    created_at: profile.created_at,
  }
}

function normalizeManagedUser(profile: UserProfileRow): AdminManagedUser {
  const normalizedRole = normalizeUserRole(profile.role)
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: normalizedRole,
    permissions: normalizePermissions(profile.permissions, normalizedRole),
    is_approved: profile.is_approved !== false,
    approved_at: profile.approved_at ?? null,
    created_at: profile.created_at,
  }
}

function getMetadataName(authUser: SupabaseAuthUser) {
  const metadataName =
    typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name.trim() : ''

  if (metadataName) {
    return metadataName
  }

  if (authUser.email) {
    return authUser.email.split('@')[0]
  }

  return 'User'
}

function getProfileSyncErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error)

  if (rawMessage.includes('null value in column "password"')) {
    return 'The users table is still using the legacy password column. Run the auth hardening SQL migration first.'
  }

  if (rawMessage.includes('users_email_key')) {
    return 'A legacy user row already exists for this email. Run the auth hardening SQL migration to map existing users to Supabase Auth.'
  }

  return rawMessage
}

function getPendingApprovalMessage() {
  return 'Your account is pending Admin approval. Please contact an Admin.'
}

async function notifyAdminAboutSignup(payload: { id: string; email: string; name: string }) {
  const webhookUrl = (import.meta.env.VITE_ADMIN_APPROVAL_WEBHOOK_URL || '').trim()

  if (!webhookUrl) {
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'new_user_signup',
        occurred_at: new Date().toISOString(),
        user: payload,
      }),
    })

    return response.ok
  } catch (error) {
    console.warn('Failed to notify admin about signup request:', error)
    return false
  }
}

async function getUserProfileRowById(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, avatar_url, preferred_primary_color, permissions, is_approved, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>()

  if (error) {
    throw error
  }

  return data
}

async function getUserProfileById(userId: string) {
  const data = await getUserProfileRowById(userId)

  if (!data) {
    return null
  }

  const access = await getUserTeamAccess(userId)
  return normalizeUserProfile(data, undefined, access)
}

async function getUserTeamAccess(userId: string) {
  const [{ data: superAdminRows, error: superAdminError }, { data: membershipRows, error: membershipsError }] =
    await Promise.all([
      supabase.from('super_admins').select('user_id').eq('user_id', userId).limit(1),
      supabase
        .from('team_memberships')
        .select(
          'team_id, user_id, role, permissions, is_default, created_at, app_teams(id, name, slug, is_active, created_at)'
        )
        .eq('user_id', userId),
    ])

  if (superAdminError) {
    throw superAdminError
  }

  if (membershipsError) {
    throw membershipsError
  }

  const isSuperadmin = Boolean(superAdminRows && superAdminRows.length > 0)
  const memberships = ((membershipRows || []) as unknown as TeamMembershipRow[])
    .map(normalizeTeamMembership)
    .filter((membership) => membership.team.is_active !== false && Boolean(membership.team.id))

  if (isSuperadmin) {
    const { data: teamRows, error: teamsError } = await supabase
      .from('app_teams')
      .select('id, name, slug, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (teamsError) {
      throw teamsError
    }

    return {
      isSuperadmin,
      memberships: ((teamRows || []) as TeamRow[]).map((team, index) => ({
        team: normalizeTeam(team),
        role: 'admin' as UserRole,
        permissions: { ...ADMIN_PERMISSIONS },
        is_default: index === 0,
        created_at: team.created_at,
      })),
    }
  }

  return {
    isSuperadmin,
    memberships,
  }
}

async function upsertUserProfile(profile: User) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      [
        {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatar_url: profile.avatar_url || '',
          preferred_primary_color: profile.preferred_primary_color || '',
          permissions: normalizePermissions(profile.permissions, profile.role),
          is_approved: profile.is_approved !== false,
          approved_at: profile.approved_at ?? null,
        },
      ],
      { onConflict: 'id' }
    )
    .select('id, email, name, role, avatar_url, preferred_primary_color, permissions, is_approved, approved_at, created_at')
    .single<UserProfileRow>()

  if (error) {
    throw new Error(getProfileSyncErrorMessage(error))
  }

  return normalizeUserProfile(data)
}

async function syncUserProfile(authUser: SupabaseAuthUser) {
  const existingProfileRow = await getUserProfileRowById(authUser.id)
  const access = await getUserTeamAccess(authUser.id)
  const existingProfile = existingProfileRow ? normalizeUserProfile(existingProfileRow, undefined, access) : null
  const metadataAvatar = getMetadataAvatar(authUser)
  const existingProfileRole = normalizeUserRole(existingProfileRow?.role)
  const desiredProfile: User = {
    id: authUser.id,
    email: authUser.email ?? existingProfile?.email ?? '',
    name: existingProfile?.name || getMetadataName(authUser),
    role: existingProfileRow ? existingProfileRole : 'viewer',
    avatar_url: metadataAvatar || existingProfile?.avatar_url,
    preferred_primary_color: existingProfile?.preferred_primary_color || '',
    permissions: normalizePermissions(existingProfileRow?.permissions, existingProfileRow ? existingProfileRole : 'viewer'),
    is_approved: existingProfile?.is_approved ?? true,
    approved_at: existingProfile?.approved_at ?? null,
    created_at: existingProfile?.created_at,
  }

  if (
    existingProfile &&
    existingProfile.email === desiredProfile.email &&
    existingProfile.name === desiredProfile.name &&
    existingProfile.role === desiredProfile.role &&
    (existingProfile.avatar_url || '') === (desiredProfile.avatar_url || '') &&
    (existingProfile.preferred_primary_color || '') === (desiredProfile.preferred_primary_color || '') &&
    existingProfile.is_approved === desiredProfile.is_approved &&
    JSON.stringify(normalizePermissions(existingProfile.permissions, existingProfile.role)) ===
      JSON.stringify(normalizePermissions(desiredProfile.permissions, desiredProfile.role))
  ) {
    return {
      ...existingProfile,
      avatar_url: desiredProfile.avatar_url,
    }
  }

  const updatedProfile = await upsertUserProfile(desiredProfile)
  return normalizeUserProfile(
    {
      id: updatedProfile.id,
      email: updatedProfile.email,
      name: updatedProfile.name,
      role: updatedProfile.role,
      avatar_url: updatedProfile.avatar_url || '',
      preferred_primary_color: updatedProfile.preferred_primary_color || '',
      permissions: updatedProfile.permissions,
      is_approved: updatedProfile.is_approved,
      approved_at: updatedProfile.approved_at,
      created_at: updatedProfile.created_at,
    },
    desiredProfile.avatar_url,
    access
  )
}

function getFormattedActivity(activity: Activity) {
  const formattedActivity: Record<string, unknown> = {
    date: activity.date,
    performer: activity.performer,
    system: activity.system ?? '',
    shift: activity.shift ?? '',
    permit_number: activity.permitNumber ?? '',
    instrument_type: activity.instrumentType ?? '',
    activityType: activity.activityType ?? '',
    tag: activity.tag ?? '',
    problem: activity.problem ?? '',
    action: activity.action ?? '',
    comments: activity.comments ?? '',
    custom_fields: activity.customFields ?? {},
    editedBy: activity.editedBy ?? null,
  }

  if (activity.id) {
    formattedActivity.id = activity.id
  }

  if (activity.created_at) {
    formattedActivity.created_at = activity.created_at
  }

  if (activity.edited_at) {
    formattedActivity.edited_at = activity.edited_at
  }

  return formattedActivity
}

function normalizeActivity(activity: Partial<Activity>): Activity {
  const databaseActivity = activity as Partial<Activity> & {
    permit_number?: string | null
    instrument_type?: string | null
    custom_fields?: Record<string, unknown> | null
  }

  return {
    id: activity.id,
    date: normalizeDateForApp(activity.date),
    performer: activity.performer ?? '',
    system: activity.system ?? '',
    shift: activity.shift ?? '',
    permitNumber: databaseActivity.permit_number ?? activity.permitNumber ?? '',
    instrumentType: databaseActivity.instrument_type ?? activity.instrumentType ?? '',
    activityType: activity.activityType ?? '',
    tag: activity.tag ?? '',
    problem: activity.problem ?? '',
    action: activity.action ?? '',
    comments: activity.comments ?? '',
    customFields: Object.entries(databaseActivity.custom_fields || {}).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        accumulator[key] = String(value ?? '')
        return accumulator
      },
      {}
    ),
    editedBy: activity.editedBy ?? null,
    created_at: activity.created_at,
    edited_at: activity.edited_at ?? null,
  }
}

function getActivityUpdatePayload(activity: Partial<Activity>) {
  const payload: Record<string, unknown> = {}

  if ('date' in activity) payload.date = activity.date
  if ('performer' in activity) payload.performer = activity.performer
  if ('system' in activity) payload.system = activity.system ?? ''
  if ('shift' in activity) payload.shift = activity.shift ?? ''
  if ('permitNumber' in activity) payload.permit_number = activity.permitNumber ?? ''
  if ('instrumentType' in activity) payload.instrument_type = activity.instrumentType ?? ''
  if ('activityType' in activity) payload.activityType = activity.activityType ?? ''
  if ('tag' in activity) payload.tag = activity.tag ?? ''
  if ('problem' in activity) payload.problem = activity.problem ?? ''
  if ('action' in activity) payload.action = activity.action ?? ''
  if ('comments' in activity) payload.comments = activity.comments ?? ''
  if ('customFields' in activity) payload.custom_fields = activity.customFields ?? {}
  if ('editedBy' in activity) payload.editedBy = activity.editedBy ?? null
  if ('edited_at' in activity) payload.edited_at = activity.edited_at ?? null

  return payload
}

function matchesSearchFilters(filters: SearchFilters) {
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'customFields') {
      return Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, string>).length > 0)
    }

    return Boolean(value)
  })
}

const ACTIVITY_FETCH_BATCH_SIZE = 1000
const SEARCH_ACTIVITY_RESULT_LIMIT = 500
const FULL_ACTIVITY_SELECT_COLUMNS =
  'id,date,performer,system,shift,permit_number,instrument_type,activityType,tag,problem,action,comments,custom_fields,editedBy,created_at,edited_at'
const DASHBOARD_ACTIVITY_SELECT_COLUMNS =
  'date,performer,system,shift,instrument_type,activityType,tag,custom_fields,editedBy,created_at,edited_at'

async function fetchAllActivitiesBatched(buildQuery: () => any, maxRows = Number.POSITIVE_INFINITY) {
  let offset = 0
  const rows: Array<Partial<Activity>> = []

  while (true) {
    const batchSize = Math.min(ACTIVITY_FETCH_BATCH_SIZE, maxRows - rows.length)
    if (batchSize <= 0) {
      break
    }

    const { data, error } = await buildQuery().range(offset, offset + batchSize - 1)

    if (error) {
      throw error
    }

    const batch = (data || []) as Array<Partial<Activity>>
    rows.push(...batch)

    if (batch.length < batchSize || rows.length >= maxRows) {
      break
    }

    offset += batchSize
  }

  return rows
}

function escapePostgrestFilterValue(value: string) {
  return value.replace(/[%*,()]/g, '\\$&')
}

function hasCommentCheckboxToken(comments: string | undefined | null, label: string) {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) {
    return false
  }

  const normalizedComments = String(comments || '').toLowerCase()
  return normalizedComments.includes(`{${normalizedLabel}}`)
}

export async function getCurrentUserProfile() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  if (!user) {
    return null
  }

  const profile = await syncUserProfile(user)
  if (profile.is_approved === false) {
    await supabase.auth.signOut({ scope: 'local' })
    return null
  }

  return profile
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    if (event === 'SIGNED_OUT') {
      callback(null)
      return
    }

    if (!session?.user) {
      return
    }

    void syncUserProfile(session.user)
      .then(async (profile) => {
        if (profile.is_approved === false) {
          await supabase.auth.signOut({ scope: 'local' })
          callback(null)
          return
        }

        callback(profile)
      })
      .catch((error) => {
        console.error('Error syncing auth state:', error)
      })
  })

  return () => subscription.unsubscribe()
}

export async function getActivities(team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const data = await fetchAllActivitiesBatched(() =>
      supabase
        .from('team_activities')
        .select(FULL_ACTIVITY_SELECT_COLUMNS)
        .eq('team_id', activeTeam.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching activities:', error)
    throw error
  }
}

export async function getRecentActivities(limit = 10, team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { data, error } = await supabase
      .from('team_activities')
      .select(FULL_ACTIVITY_SELECT_COLUMNS)
      .eq('team_id', activeTeam.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching recent activities:', error)
    throw error
  }
}

export async function getDashboardActivities(team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const data = await fetchAllActivitiesBatched(() =>
      supabase
        .from('team_activities')
        .select(DASHBOARD_ACTIVITY_SELECT_COLUMNS)
        .eq('team_id', activeTeam.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching dashboard activities:', error)
    throw error
  }
}

export async function createActivity(activity: Activity, team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { data, error } = await supabase
      .from('team_activities')
      .insert([{ ...getFormattedActivity(activity), team_id: activeTeam.id }])
      .select()

    if (error) throw error
    return data?.[0] ? normalizeActivity(data[0] as Partial<Activity>) : undefined
  } catch (error) {
    console.error('Error creating activity:', error)
    throw new Error(getActivityWriteErrorMessage(error, 'create'))
  }
}

export async function createActivities(activities: Activity[], team?: Team | null) {
  try {
    if (activities.length === 0) {
      return 0
    }

    const activeTeam = requireActiveTeam(team)
    const { error } = await supabase
      .from('team_activities')
      .insert(activities.map((activity) => ({ ...getFormattedActivity(activity), team_id: activeTeam.id })))

    if (error) throw error
    return activities.length
  } catch (error) {
    console.error('Error bulk creating activities:', error)
    throw new Error(getActivityWriteErrorMessage(error, 'bulk create'))
  }
}

export async function updateActivity(id: string, activity: Partial<Activity>, team?: Team | null) {
  try {
    const updatePayload = getActivityUpdatePayload(activity)
    const activeTeam = requireActiveTeam(team)
    const { data, error } = await supabase
      .from('team_activities')
      .update(updatePayload)
      .eq('id', id)
      .eq('team_id', activeTeam.id)
      .select()

    if (error) {
      if ('edited_at' in updatePayload && isMissingColumnError(error, 'edited_at')) {
        const { edited_at: _editedAt, ...fallbackPayload } = updatePayload
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('team_activities')
          .update(fallbackPayload)
          .eq('id', id)
          .eq('team_id', activeTeam.id)
          .select()

        if (!fallbackError) {
          return fallbackData?.[0] ? normalizeActivity(fallbackData[0] as Partial<Activity>) : undefined
        }
      }

      const errorMessage = error.message || JSON.stringify(error)
      throw new Error(`Update failed: ${errorMessage}`)
    }

    return data?.[0] ? normalizeActivity(data[0] as Partial<Activity>) : undefined
  } catch (error) {
    console.error('Error updating activity:', error)
    throw error
  }
}

export async function deleteActivity(id: string, team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { error } = await supabase.from('team_activities').delete().eq('id', id).eq('team_id', activeTeam.id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting activity:', error)
    throw error
  }
}

export async function signUp(email: string, name: string, password: string): Promise<AuthActionResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    })

    if (error) throw error
    if (!data.user) {
      throw new Error('Unable to create account.')
    }

    const adminNotified = await notifyAdminAboutSignup({
      id: data.user.id,
      email: email.trim(),
      name: name.trim(),
    })
    const pendingApprovalMessage = adminNotified
      ? 'Account created. A confirmation request was sent to Admin for approval.'
      : 'Account created. Your account is pending Admin approval.'

    if (!data.session) {
      return {
        requiresEmailConfirmation: true,
        message: pendingApprovalMessage,
      }
    }

    const profile = await syncUserProfile(data.user)

    if (profile.is_approved === false) {
      await supabase.auth.signOut({ scope: 'local' })

      return {
        requiresEmailConfirmation: true,
        message: pendingApprovalMessage,
      }
    }

    return {
      user: profile,
      requiresEmailConfirmation: false,
    }
  } catch (error) {
    console.error('Error signing up:', error)
    throw error
  }
}

export async function login(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    if (!data.user) {
      throw new Error('Unable to sign in.')
    }

    const profile = await syncUserProfile(data.user)

    if (profile.is_approved === false) {
      await supabase.auth.signOut({ scope: 'local' })
      throw new Error(getPendingApprovalMessage())
    }

    return profile
  } catch (error) {
    console.error('Error logging in:', error)
    throw error
  }
}

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) throw error
  } catch (error) {
    console.error('Error logging out:', error)
    throw error
  }
}

export async function getUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching users:', error)
    throw error
  }
}

export async function getEditors(team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const [{ data: superAdmins, error: superAdminError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        supabase.from('super_admins').select('user_id'),
        supabase
          .from('team_memberships')
          .select('user_id, role')
          .eq('team_id', activeTeam.id)
          .in('role', ['editor', 'admin']),
      ])

    if (superAdminError) throw superAdminError
    if (membershipsError) throw membershipsError

    const superAdminIds = new Set(((superAdmins || []) as Array<{ user_id: string }>).map((row) => row.user_id))
    const editorIds = ((memberships || []) as Array<{ user_id: string }>).map((membership) => membership.user_id)

    if (editorIds.length === 0) {
      return []
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', editorIds)
      .order('name', { ascending: true })

    if (usersError) throw usersError
    return (users || []).filter((user) => !superAdminIds.has(user.id))
  } catch (error) {
    console.error('Error fetching editors:', error)
    throw error
  }
}

export async function getActivitiesByUser(userName: string, team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { data, error } = await supabase
      .from('team_activities')
      .select('*')
      .eq('team_id', activeTeam.id)
      .eq('performer', userName)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching user activities:', error)
    throw error
  }
}

export async function updateUserDetails(userId: string, details: UpdateUserDetailsInput): Promise<UpdateUserDetailsResult> {
  try {
    const trimmedName = details.name.trim()
    const trimmedEmail = details.email.trim()
    const trimmedAvatarUrl = details.avatarUrl?.trim() || ''
    const trimmedPreferredPrimaryColor = details.preferredPrimaryColor?.trim() || ''

    const {
      data: { user: authUser },
      error: getUserError,
    } = await supabase.auth.getUser()

    if (getUserError) throw getUserError
    if (!authUser || authUser.id !== userId) {
      throw new Error('You can only update your own account.')
    }

    const authUpdates: UserAttributes = {
      data: {
        ...authUser.user_metadata,
        name: trimmedName,
        avatar_url: trimmedAvatarUrl || null,
      },
    }

    if (trimmedEmail && trimmedEmail !== authUser.email) {
      authUpdates.email = trimmedEmail
    }

    if (details.password?.trim()) {
      authUpdates.password = details.password.trim()
    }

    let updatedAuthUser = authUser
    if (authUpdates.email || authUpdates.password || authUpdates.data) {
      const { data, error } = await supabase.auth.updateUser(authUpdates)
      if (error) throw error
      updatedAuthUser = data.user ?? authUser
    }

    const emailChangePending = Boolean(authUpdates.email && updatedAuthUser.email !== trimmedEmail)
    const emailForProfile = updatedAuthUser.email ?? authUser.email ?? trimmedEmail

    const { data: updatedProfile, error: profileError } = await supabase
      .from('users')
      .update({
        name: trimmedName,
        email: emailForProfile,
        avatar_url: trimmedAvatarUrl,
        preferred_primary_color: trimmedPreferredPrimaryColor,
      })
      .eq('id', userId)
      .select('id, email, name, role, avatar_url, preferred_primary_color, permissions, is_approved, approved_at, created_at')
      .single<UserProfileRow>()

    if (profileError) throw profileError

    const access = await getUserTeamAccess(userId)

    return {
      user: normalizeUserProfile(updatedProfile, getMetadataAvatar(updatedAuthUser) || trimmedAvatarUrl, access),
      emailChangePending,
      pendingEmail: emailChangePending ? trimmedEmail : undefined,
    }
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

export async function getSettings(team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { data, error } = await supabase
      .from('team_settings')
      .select('*')
      .eq('team_id', activeTeam.id)
      .maybeSingle()

    if (error) throw error

    if (data) {
      return {
        ...DEFAULT_SETTINGS,
        ...data,
      } as Settings
    }

    return getEmptyDynamicTeamSettings(activeTeam.name)
  } catch (error) {
    console.error('Error fetching settings:', error)
    throw error
  }
}

export async function updateSettings(settings: Partial<Settings>, userId: string, team?: Team | null) {
  try {
    const activeTeam = requireActiveTeam(team)
    const { data: existingSettings, error: existingSettingsError } = await supabase
      .from('team_settings')
      .select('*')
      .eq('team_id', activeTeam.id)
      .maybeSingle()

    if (existingSettingsError) throw existingSettingsError

    const buildPayload = (includeMocVisibility: boolean) => {
      const baseDefaults = includeMocVisibility
        ? DEFAULT_SETTINGS
        : Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([key]) => key !== 'show_moc_activity'))
      const mergedExistingSettings = includeMocVisibility
        ? existingSettings || {}
        : Object.fromEntries(Object.entries(existingSettings || {}).filter(([key]) => key !== 'show_moc_activity'))
      const mergedIncomingSettings = includeMocVisibility
        ? settings
        : Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'show_moc_activity'))

      return {
        ...baseDefaults,
        ...mergedExistingSettings,
        ...mergedIncomingSettings,
        team_id: activeTeam.id,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      }
    }

    let retriedWithoutMocVisibility = false
    let { data, error } = await supabase
      .from('team_settings')
      .upsert([buildPayload(true)], { onConflict: 'team_id' })
      .select()
      .single()

    if (error && isMissingColumnError(error, 'show_moc_activity')) {
      retriedWithoutMocVisibility = true
      ;({ data, error } = await supabase
        .from('team_settings')
        .upsert([buildPayload(false)], { onConflict: 'team_id' })
        .select()
        .single())
    }

    if (error) throw error
    reusableEditorCatalogCache = null
    return {
      ...DEFAULT_SETTINGS,
      ...(data as Settings),
      show_moc_activity:
        retriedWithoutMocVisibility || !('show_moc_activity' in (data || {}))
          ? settings.show_moc_activity ?? existingSettings?.show_moc_activity ?? DEFAULT_SETTINGS.show_moc_activity
          : (data as Settings).show_moc_activity,
    } as Settings
  } catch (error) {
    console.error('Error updating settings:', error)
    throw error
  }
}

export async function getAdminUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'admin')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching admin users:', error)
    throw error
  }
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
}

export async function uploadUserPhoto(userId: string, file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'png' : 'png'
  const filePath = `${userId}/${Date.now()}-${sanitizeFileName(file.name || `photo.${extension}`)}`

  const { error } = await supabase.storage.from('user-photos').upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from('user-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function getUsersCount() {
  const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  return count || 0
}

export async function getEditorsCount(team?: Team | null) {
  return (await getEditors(team)).length
}

export async function getManagedTeams(): Promise<ManagedTeam[]> {
  const [{ data: teams, error: teamsError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase
        .from('app_teams')
        .select('id, name, slug, is_active, created_at')
        .order('name', { ascending: true }),
      supabase.from('team_memberships').select('team_id'),
    ])

  if (teamsError) throw teamsError
  if (membershipsError) throw membershipsError

  const memberCounts = ((memberships || []) as Array<{ team_id: string }>).reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.team_id] = (counts[item.team_id] || 0) + 1
      return counts
    },
    {}
  )

  return ((teams || []) as TeamRow[]).map((team) => ({
    ...normalizeTeam(team),
    is_active: team.is_active !== false,
    member_count: memberCounts[team.id] || 0,
  }))
}

export async function getReusableEditorCatalogs(): Promise<ReusableEditorCatalogs> {
  const now = Date.now()
  if (reusableEditorCatalogCache && reusableEditorCatalogCache.expiresAt > now) {
    return reusableEditorCatalogCache.value
  }

  const { data, error } = await supabase
    .from('team_settings')
    .select('activity_field_definitions, dashboard_chart_definitions, dashboard_card_definitions')

  if (error) {
    throw error
  }

  const fieldMap = new Map<string, StoredActivityFieldDefinition>()
  getCoreActivityFieldDefinitions().forEach((field) => {
    fieldMap.set(field.key, {
      key: field.key,
      label: field.label,
      placeholder: field.placeholder,
      type: field.type,
      options: field.options || [],
      searchable: field.searchable !== false,
      tableBadge: Boolean(field.tableBadge),
      archived: false,
    })
  })

  const rows = (data || []) as Array<{
    activity_field_definitions?: unknown
    dashboard_chart_definitions?: unknown
    dashboard_card_definitions?: unknown
  }>

  rows.forEach((row) => {
    normalizeStoredActivityFieldDefinitions(row.activity_field_definitions).forEach((field) => {
      if (!field.archived && !fieldMap.has(field.key)) {
        fieldMap.set(field.key, field)
      }
    })
  })

  const fieldCatalog = Array.from(fieldMap.values())
  const fieldCatalogSettings = {
    activity_field_definitions: fieldCatalog,
  } as Settings

  const chartMap = new Map<string, StoredDashboardChartDefinition>()
  getCoreDashboardChartDefinitions().forEach((chart) => {
    chartMap.set(chart.key, {
      key: chart.key,
      label: chart.label,
      fieldKey: chart.fieldKey,
      chartType: chart.chartType,
      maxItems: chart.maxItems,
      includeEmpty: chart.includeEmpty,
      archived: false,
    })
  })

  rows.forEach((row) => {
    normalizeStoredDashboardChartDefinitions(row.dashboard_chart_definitions, fieldCatalogSettings).forEach((chart) => {
      if (!chart.archived && !chartMap.has(chart.key)) {
        chartMap.set(chart.key, chart)
      }
    })
  })

  const cardMap = new Map<string, StoredDashboardCardDefinition>()
  getCoreDashboardCardDefinitions().forEach((card) => {
    cardMap.set(card.key, {
      key: card.key,
      label: card.label,
      metric: card.metric,
      icon: card.icon,
      fieldKey: card.fieldKey,
      fieldValue: card.fieldValue,
      description: card.description,
      archived: false,
    })
  })

  rows.forEach((row) => {
    normalizeStoredDashboardCardDefinitions(row.dashboard_card_definitions).forEach((card) => {
      if (!card.archived && !cardMap.has(card.key)) {
        cardMap.set(card.key, card)
      }
    })
  })

  const catalogs = {
    fields: Array.from(fieldMap.values()),
    charts: Array.from(chartMap.values()),
    cards: Array.from(cardMap.values()),
  }
  reusableEditorCatalogCache = {
    value: catalogs,
    expiresAt: now + 60_000,
  }

  return catalogs
}

function slugifyTeamName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createManagedTeam(input: { name: string; slug?: string }) {
  const name = input.name.trim()
  const slug = (input.slug?.trim() || slugifyTeamName(name)).toLowerCase()

  if (!name || !slug) {
    throw new Error('Team name is required.')
  }

  const { data, error } = await supabase
    .from('app_teams')
    .insert([{ name, slug }])
    .select('id, name, slug, is_active, created_at')
    .single<TeamRow>()

  if (error) {
    throw error
  }

  const initialTeamSettings = getEmptyDynamicTeamSettings(data.name)

  const buildInitialTeamSettingsPayload = (includeMocVisibility: boolean) => ({
    team_id: data.id,
    webapp_name: initialTeamSettings.webapp_name,
    browser_tab_name: initialTeamSettings.browser_tab_name,
    ...(includeMocVisibility ? { show_moc_activity: false } : {}),
    activity_field_definitions: initialTeamSettings.activity_field_definitions,
    activity_field_config: initialTeamSettings.activity_field_config,
    dashboard_chart_definitions: initialTeamSettings.dashboard_chart_definitions,
    dashboard_chart_config: initialTeamSettings.dashboard_chart_config,
    dashboard_card_definitions: initialTeamSettings.dashboard_card_definitions,
    dashboard_card_config: initialTeamSettings.dashboard_card_config,
  })

  let { error: settingsInsertError } = await supabase.from('team_settings').insert([buildInitialTeamSettingsPayload(true)])

  if (settingsInsertError && isMissingColumnError(settingsInsertError, 'show_moc_activity')) {
    ;({ error: settingsInsertError } = await supabase.from('team_settings').insert([buildInitialTeamSettingsPayload(false)]))
  }

  if (settingsInsertError) {
    throw settingsInsertError
  }

  return normalizeTeam(data)
}

export async function updateManagedTeam(teamId: string, input: { name: string }) {
  const name = input.name.trim()

  if (!name) {
    throw new Error('Team name is required.')
  }

  const { data, error } = await supabase
    .from('app_teams')
    .update({ name })
    .eq('id', teamId)
    .select('id, name, slug, is_active, created_at')
    .single<TeamRow>()

  if (error) {
    throw error
  }

  return normalizeTeam(data)
}

export async function deleteManagedTeam(teamId: string) {
  const { data: team, error: teamError } = await supabase
    .from('app_teams')
    .select('id, name, slug')
    .eq('id', teamId)
    .single<{ id: string; name: string; slug: string }>()

  if (teamError) {
    throw teamError
  }

  const { error } = await supabase.from('app_teams').delete().eq('id', teamId)

  if (error) {
    throw error
  }
}

export async function getManagedUsers() {
  const { data: superAdminRows, error: superAdminError } = await supabase.from('super_admins').select('user_id')

  if (superAdminError) {
    throw superAdminError
  }

  const superAdminIds = new Set(((superAdminRows || []) as Array<{ user_id: string }>).map((row) => row.user_id))

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, permissions, is_approved, approved_at, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data || [])
    .filter((user) => !superAdminIds.has(user.id))
    .map((user) => normalizeManagedUser(user as UserProfileRow))
}

export async function getTeamManagedUsers(): Promise<TeamManagedUser[]> {
  const users = await getManagedUsers()
  const { data, error } = await supabase.from('team_memberships').select('team_id, user_id, role')

  if (error) throw error

  const membershipsByUser = ((data || []) as Array<{ team_id: string; user_id: string; role: UserRole | null }>).reduce<
    Record<string, { teamIds: string[]; teamRoles: Record<string, UserRole> }>
  >((accumulator, membership) => {
    accumulator[membership.user_id] = accumulator[membership.user_id] || { teamIds: [], teamRoles: {} }
    accumulator[membership.user_id].teamIds.push(membership.team_id)
    accumulator[membership.user_id].teamRoles[membership.team_id] = normalizeUserRole(membership.role)
    return accumulator
  }, {})

  return users.map((user) => ({
    ...user,
    team_ids: membershipsByUser[user.id]?.teamIds || [],
    team_roles: membershipsByUser[user.id]?.teamRoles || {},
  }))
}

export async function setUserTeamMembership(input: {
  userId: string
  teamId: string
  enabled: boolean
  role?: UserRole
}) {
  if (!input.enabled) {
    const { error } = await supabase
      .from('team_memberships')
      .delete()
      .eq('user_id', input.userId)
      .eq('team_id', input.teamId)

    if (error) throw error
    return
  }

  const role = input.role || 'viewer'
  const { error } = await supabase.from('team_memberships').upsert(
    [
      {
        user_id: input.userId,
        team_id: input.teamId,
        role,
        permissions: normalizePermissions(undefined, role),
      },
    ],
    { onConflict: 'team_id,user_id' }
  )

  if (error) {
    throw error
  }
}

export async function createManagedUser(input: {
  id: string
  email: string
  name: string
  role: UserRole
}) {
  const permissions = normalizePermissions(undefined, input.role)

  const { data, error } = await supabase
    .from('users')
    .upsert(
      [
        {
          id: input.id,
          email: input.email.trim(),
          name: input.name.trim(),
          role: input.role,
          permissions,
        },
      ],
      { onConflict: 'id' }
    )
    .select('id, email, name, role, permissions, is_approved, approved_at, created_at')
    .single<UserProfileRow>()

  if (error) {
    throw error
  }

  return normalizeManagedUser(data)
}

export async function updateManagedUser(userId: string, input: UpdateManagedUserInput) {
  const payload: Record<string, unknown> = {}

  if (input.teamId && input.role) {
    await setUserTeamMembership({
      userId,
      teamId: input.teamId,
      enabled: true,
      role: input.role,
    })
  }

  if (typeof input.email === 'string') {
    payload.email = input.email.trim()
  }

  if (typeof input.name === 'string') {
    payload.name = input.name.trim()
  }

  if (input.role && !input.teamId) {
    payload.role = input.role
    payload.permissions = normalizePermissions(undefined, input.role)
  }

  if (typeof input.isApproved === 'boolean') {
    payload.is_approved = input.isApproved
    payload.approved_at = input.isApproved ? new Date().toISOString() : null
  }

  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, permissions, is_approved, approved_at, created_at')
      .eq('id', userId)
      .single<UserProfileRow>()

    if (error) {
      throw error
    }

    return normalizeManagedUser(data)
  }

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select('id, email, name, role, permissions, is_approved, approved_at, created_at')
    .single<UserProfileRow>()

  if (error) {
    throw error
  }

  return normalizeManagedUser(data)
}

export async function deleteManagedUser(userId: string) {
  const { error } = await supabase.rpc('admin_delete_user', {
    target_user_id: userId,
  })

  if (error) {
    throw error
  }
}

export async function uploadBrandingAsset(adminUserId: string, kind: 'logo' | 'favicon', file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'png' : 'png'
  const sanitizedName = sanitizeFileName(file.name || `${kind}.${extension}`)
  const filePath = `${kind}/${adminUserId}/${Date.now()}-${sanitizedName}`

  const { error } = await supabase.storage.from('branding-assets').upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from('branding-assets').getPublicUrl(filePath)
  return data.publicUrl
}

export async function searchActivities(filters: SearchFilters, team?: Team | null) {
  try {
    if (!matchesSearchFilters(filters)) {
      return getActivities(team)
    }

    const activeTeam = requireActiveTeam(team)
    let query = supabase.from('team_activities').select(FULL_ACTIVITY_SELECT_COLUMNS).eq('team_id', activeTeam.id)
    const hasDateFilters = Boolean(filters.date || filters.startDate || filters.endDate)

    if (hasDateFilters) {
      query = query.neq('date', '')
    }

    if (filters.date) {
      query = query.eq('date', filters.date)
    } else {
      if (filters.startDate) {
        query = query.gte('date', filters.startDate)
      }

      if (filters.endDate) {
        query = query.lte('date', filters.endDate)
      }
    }

    if (filters.performer) {
      query = query.ilike('performer', `%${filters.performer}%`)
    }

    if (filters.tag) {
      query = query.ilike('tag', `%${filters.tag}%`)
    }

    if (filters.system) {
      query = query.eq('system', filters.system)
    }

    if (filters.shift) {
      query = query.eq('shift', filters.shift)
    }

    if (filters.permitNumber) {
      query = query.ilike('permit_number', `%${filters.permitNumber}%`)
    }

    if (filters.instrumentType) {
      query = query.ilike('instrument_type', `%${filters.instrumentType}%`)
    }

    if (filters.problem) {
      query = query.ilike('problem', `%${filters.problem}%`)
    }

    if (filters.action) {
      query = query.ilike('action', `%${filters.action}%`)
    }

    if (filters.comments) {
      query = query.ilike('comments', `%${filters.comments}%`)
    }

    if (filters.activityType) {
      query = query.eq('activityType', filters.activityType)
    }

    if (filters.hasMoc) {
      query = query.ilike('comments', '%{MOC}%')
    }

    if (filters.checkboxLabels) {
      Object.entries(filters.checkboxLabels).forEach(([fieldKey, label]) => {
        if (fieldKey !== 'mocActivity' && label) {
          query = query.ilike('comments', `%{${label}}%`)
        }
      })
    }

    if (filters.keyword) {
      const keyword = escapePostgrestFilterValue(filters.keyword.trim())
      if (keyword) {
        const keywordPattern = `*${keyword}*`
        query = query.or(
          [
            `date.ilike.${keywordPattern}`,
            `performer.ilike.${keywordPattern}`,
            `system.ilike.${keywordPattern}`,
            `shift.ilike.${keywordPattern}`,
            `permit_number.ilike.${keywordPattern}`,
            `instrument_type.ilike.${keywordPattern}`,
            `activityType.ilike.${keywordPattern}`,
            `tag.ilike.${keywordPattern}`,
            `problem.ilike.${keywordPattern}`,
            `action.ilike.${keywordPattern}`,
            `comments.ilike.${keywordPattern}`,
          ].join(',')
        )
      }
    }

    const data = await fetchAllActivitiesBatched(() =>
      query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      SEARCH_ACTIVITY_RESULT_LIMIT
    )

    let results = (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))

    if (filters.customFields && Object.keys(filters.customFields).length > 0) {
      results = results.filter((activity) =>
        Object.entries(filters.customFields || {}).every(([fieldKey, value]) => {
          const activityValue = String(activity.customFields?.[fieldKey] || '')

          if (typeof value === 'boolean') {
            const checkboxLabel = filters.checkboxLabels?.[fieldKey]
            return value
              ? activityValue.toLowerCase() === 'true' || Boolean(checkboxLabel && hasCommentCheckboxToken(activity.comments, checkboxLabel))
              : !activityValue
          }

          return activityValue.toLowerCase().includes(String(value || '').toLowerCase())
        })
      )
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      results = results.filter((activity) =>
        [
          activity.date,
          formatDateForDisplay(activity.date),
          activity.performer,
          activity.system,
          activity.shift,
          activity.permitNumber,
          activity.instrumentType,
          activity.activityType,
          getActivityTypeLabel(activity.activityType),
          activity.tag,
          activity.problem,
          activity.action,
          activity.comments ?? '',
          ...Object.values(activity.customFields || {}),
        ].some((field) => String(field).toLowerCase().includes(keyword))
      )
    }

    if (filters.hasMoc) {
      results = results.filter((activity) => String(activity.comments || '').toLowerCase().includes('{moc}'))
    }

    return results
  } catch (error) {
    console.error('Error searching activities:', error)
    throw error
  }
}

export async function getActivitiesForDashboardFilter(filter: DashboardResultsFilter, team?: Team | null) {
  try {
    if (filter.kind === 'all') {
      return getActivities(team)
    }

    const activeTeam = requireActiveTeam(team)
    const buildQuery = () => {
      let query = supabase.from('team_activities').select(FULL_ACTIVITY_SELECT_COLUMNS).eq('team_id', activeTeam.id)

      switch (filter.kind) {
        case 'performer':
          query = query.eq('performer', filter.performer)
          break
        case 'performerIn':
          query = query.in('performer', filter.performers)
          break
        case 'hasField':
          query = query.not(filter.field, 'is', null).neq(filter.field, '')
          break
        case 'fieldHasValue':
          if (
            ['date', 'performer', 'system', 'shift', 'permitNumber', 'instrumentType', 'activityType', 'tag', 'problem', 'action', 'comments'].includes(
              filter.fieldKey
            )
          ) {
            const databaseFieldKey =
              filter.fieldKey === 'permitNumber'
                ? 'permit_number'
                : filter.fieldKey === 'instrumentType'
                  ? 'instrument_type'
                  : filter.fieldKey
            query = query.not(databaseFieldKey, 'is', null).neq(databaseFieldKey, '')
          }
          break
        case 'fieldValue':
          if (
            ['date', 'performer', 'system', 'shift', 'permitNumber', 'instrumentType', 'activityType', 'tag', 'problem', 'action', 'comments'].includes(
              filter.fieldKey
            )
          ) {
            const databaseFieldKey =
              filter.fieldKey === 'permitNumber'
                ? 'permit_number'
                : filter.fieldKey === 'instrumentType'
                  ? 'instrument_type'
                  : filter.fieldKey
            query = query.eq(databaseFieldKey, filter.fieldValue)
          }
          break
        case 'recentlyEdited':
          query = query.not('edited_at', 'is', null)
          break
        case 'sinceDate':
          query = query.gte('date', filter.sinceDate)
          break
        case 'activityType':
          query = query.eq('activityType', filter.activityType)
          break
        case 'system':
          query = query.eq('system', filter.system)
          break
        case 'shift':
          query = query.eq('shift', filter.shift)
          break
        case 'instrumentType':
          query = query.eq('instrument_type', filter.instrumentType)
          break
        case 'tag':
          query = query.eq('tag', filter.tag)
          break
        default:
          break
      }

      if (filter.kind === 'recentlyEdited') {
        return query
          .order('edited_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(filter.limit)
      }

      return query.order('date', { ascending: false }).order('created_at', { ascending: false })
    }

    const data = await fetchAllActivitiesBatched(buildQuery)
    let results = (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))

    if (filter.kind === 'fieldHasValue' && !['date', 'performer', 'system', 'shift', 'permitNumber', 'instrumentType', 'activityType', 'tag', 'problem', 'action', 'comments'].includes(filter.fieldKey)) {
      results = results.filter((activity) => Boolean(String(activity.customFields?.[filter.fieldKey] || '').trim()))
    }

    if (filter.kind === 'fieldValue' && !['date', 'performer', 'system', 'shift', 'permitNumber', 'instrumentType', 'activityType', 'tag', 'problem', 'action', 'comments'].includes(filter.fieldKey)) {
      results = results.filter((activity) => String(activity.customFields?.[filter.fieldKey] || '') === filter.fieldValue)
    }

    return results
  } catch (error) {
    console.error('Error fetching dashboard filter activities:', error)
    throw error
  }
}
