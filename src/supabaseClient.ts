import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User as SupabaseAuthUser,
  type UserAttributes,
} from '@supabase/supabase-js'
import { type ActivityTypeValue, getActivityTypeLabel } from './constants/activityTypes'
import { formatDateForDisplay, normalizeDateForApp } from './utils/date'

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
  activityType: ActivityTypeValue | ''
  tag: string
  problem: string
  action: string
  comments: string
  editedBy?: string | null
  created_at?: string
  edited_at?: string | null
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface Team {
  id: string
  name: string
  slug: string
  uses_legacy_tables: boolean
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
  header_font_family?: string
  header_font_size?: string
  subheader_font_family?: string
  subheader_font_size?: string
  sidebar_font_family?: string
  sidebar_font_size?: string
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
  last_sign_in_at?: string | null
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
  uses_legacy_tables: boolean
  is_active: boolean
  member_count: number
  created_at?: string
}

export interface TeamManagedUser extends AdminManagedUser {
  team_ids: string[]
  team_roles: Record<string, UserRole>
}

type TeamRow = {
  id: string
  name: string
  slug: string
  uses_legacy_tables?: boolean | null
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
  header_font_family: '',
  header_font_size: '2.5rem',
  subheader_font_family: '',
  subheader_font_size: '1.5rem',
  sidebar_font_family: '',
  sidebar_font_size: '0.95rem',
}

export const LEGACY_AUTOMATION_TEAM: Team = {
  id: 'automation',
  name: 'Automation',
  slug: 'automation',
  uses_legacy_tables: true,
  is_active: true,
}

const TEAM_SCHEMA_MISSING_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204'])

function isTeamSchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | undefined
  const message = maybeError?.message || ''

  return Boolean(
    (maybeError?.code && TEAM_SCHEMA_MISSING_CODES.has(maybeError.code)) ||
      message.includes('app_teams') ||
      message.includes('team_memberships') ||
      message.includes('team_activities') ||
      message.includes('team_settings') ||
      message.includes('super_admins')
  )
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

function getActiveTeamOrLegacy(team?: Team | null) {
  return team || LEGACY_AUTOMATION_TEAM
}

function shouldUseLegacyTables(team?: Team | null) {
  return getActiveTeamOrLegacy(team).uses_legacy_tables
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
  import: true,
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
    return LEGACY_AUTOMATION_TEAM
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    uses_legacy_tables: row.uses_legacy_tables === true,
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
    active_team: preferredMembership?.team || LEGACY_AUTOMATION_TEAM,
    team_memberships: access.memberships?.length
      ? access.memberships
      : [
          {
            team: LEGACY_AUTOMATION_TEAM,
            role: normalizedRole,
            permissions: normalizedPermissions,
            is_default: true,
          },
        ],
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
  try {
    const [{ data: superAdminRows, error: superAdminError }, { data: membershipRows, error: membershipsError }] =
      await Promise.all([
        supabase.from('super_admins').select('user_id').eq('user_id', userId).limit(1),
        supabase
          .from('team_memberships')
          .select(
            'team_id, user_id, role, permissions, is_default, created_at, app_teams(id, name, slug, uses_legacy_tables, is_active, created_at)'
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
      .filter((membership) => membership.team.is_active !== false)

    if (isSuperadmin) {
      const { data: teamRows, error: teamsError } = await supabase
        .from('app_teams')
        .select('id, name, slug, uses_legacy_tables, is_active, created_at')
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
          is_default: team.slug === 'automation' || index === 0,
          created_at: team.created_at,
        })),
      }
    }

    return {
      isSuperadmin,
      memberships,
    }
  } catch (error) {
    if (!isTeamSchemaMissingError(error)) {
      throw error
    }

    return {
      isSuperadmin: false,
      memberships: [],
    }
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

async function recordUserSignIn(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('id', userId)

  if (error && !isMissingColumnError(error, 'last_sign_in_at')) {
    throw error
  }
}

function getFormattedActivity(activity: Activity) {
  return {
    ...activity,
    activityType: activity.activityType ?? '',
    comments: activity.comments ?? '',
    editedBy: activity.editedBy ?? null,
  }
}

function normalizeActivity(activity: Partial<Activity>): Activity {
  return {
    id: activity.id,
    date: normalizeDateForApp(activity.date),
    performer: activity.performer ?? '',
    system: activity.system ?? '',
    activityType: activity.activityType ?? '',
    tag: activity.tag ?? '',
    problem: activity.problem ?? '',
    action: activity.action ?? '',
    comments: activity.comments ?? '',
    editedBy: activity.editedBy ?? null,
    created_at: activity.created_at,
    edited_at: activity.edited_at ?? null,
  }
}

function matchesSearchFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => Boolean(value))
}

const ACTIVITY_FETCH_BATCH_SIZE = 1000

async function fetchAllActivitiesBatched(buildQuery: () => any) {
  let offset = 0
  const rows: Array<Partial<Activity>> = []

  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + ACTIVITY_FETCH_BATCH_SIZE - 1)

    if (error) {
      throw error
    }

    const batch = (data || []) as Array<Partial<Activity>>
    rows.push(...batch)

    if (batch.length < ACTIVITY_FETCH_BATCH_SIZE) {
      break
    }

    offset += ACTIVITY_FETCH_BATCH_SIZE
  }

  return rows
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
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const data = await fetchAllActivitiesBatched(() =>
        supabase
          .from('team_activities')
          .select('*')
          .eq('team_id', activeTeam.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
      )

      return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
    }

    const data = await fetchAllActivitiesBatched(() =>
      supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    )
    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching activities:', error)
    throw error
  }
}

export async function createActivity(activity: Activity, team?: Team | null) {
  try {
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const { data, error } = await supabase
        .from('team_activities')
        .insert([{ ...getFormattedActivity(activity), team_id: activeTeam.id }])
        .select()

      if (error) throw error
      return data?.[0] ? normalizeActivity(data[0] as Partial<Activity>) : undefined
    }

    const { data, error } = await supabase
      .from('activities')
      .insert([getFormattedActivity(activity)])
      .select()

    if (error) throw error
    return data?.[0] ? normalizeActivity(data[0] as Partial<Activity>) : undefined
  } catch (error) {
    console.error('Error creating activity:', error)
    throw error
  }
}

export async function createActivities(activities: Activity[], team?: Team | null) {
  try {
    if (activities.length === 0) {
      return 0
    }

    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const { error } = await supabase
        .from('team_activities')
        .insert(activities.map((activity) => ({ ...getFormattedActivity(activity), team_id: activeTeam.id })))

      if (error) throw error
      return activities.length
    }

    const { error } = await supabase.from('activities').insert(activities.map(getFormattedActivity))

    if (error) throw error
    return activities.length
  } catch (error) {
    console.error('Error bulk creating activities:', error)
    throw error
  }
}

export async function updateActivity(id: string, activity: Partial<Activity>, team?: Team | null) {
  try {
    const updatePayload = {
      ...activity,
      comments: activity.comments ?? '',
    }

    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
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
    }

    const { data, error } = await supabase
      .from('activities')
      .update(updatePayload)
      .eq('id', id)
      .select()

    if (error) {
      if ('edited_at' in updatePayload && isMissingColumnError(error, 'edited_at')) {
        const { edited_at: _editedAt, ...fallbackPayload } = updatePayload
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('activities')
          .update(fallbackPayload)
          .eq('id', id)
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
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const { error } = await supabase.from('team_activities').delete().eq('id', id).eq('team_id', activeTeam.id)

      if (error) throw error
      return
    }

    const { error } = await supabase.from('activities').delete().eq('id', id)

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

    await recordUserSignIn(data.user.id)

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
    let superAdminIds = new Set<string>()
    try {
      const [{ data: superAdmins, error: superAdminError }, { data: superAdminUsers, error: superAdminUsersError }] =
        await Promise.all([
          supabase.from('super_admins').select('user_id'),
          supabase.from('users').select('id').eq('role', 'superadmin'),
        ])

      if (superAdminError) throw superAdminError
      if (superAdminUsersError) throw superAdminUsersError

      superAdminIds = new Set([
        ...((superAdmins || []) as Array<{ user_id: string }>).map((row) => row.user_id),
        ...((superAdminUsers || []) as Array<{ id: string }>).map((row) => row.id),
      ])
    } catch (error) {
      if (!isTeamSchemaMissingError(error)) {
        throw error
      }
    }

    if (team?.id && !shouldUseLegacyTables(team)) {
      const { data, error } = await supabase
        .from('team_memberships')
        .select('user_id, user_name, role')
        .eq('team_id', team.id)
        .in('role', ['editor', 'admin'])
        .order('user_name', { ascending: true })

      if (error) throw error

      return ((data || []) as Array<{ user_id: string; user_name: string }>)
        .filter((membership) => !superAdminIds.has(membership.user_id))
        .map((membership) => ({
          id: membership.user_id,
          name: membership.user_name,
          email: '',
        }))
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')
      .in('role', ['editor', 'admin'])
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).filter((user) => !superAdminIds.has(user.id))
  } catch (error) {
    console.error('Error fetching editors:', error)
    throw error
  }
}

export async function getActivitiesByUser(userName: string, team?: Team | null) {
  try {
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const { data, error } = await supabase
        .from('team_activities')
        .select('*')
        .eq('team_id', activeTeam.id)
        .eq('performer', userName)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
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
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
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

      return {
        ...DEFAULT_SETTINGS,
        webapp_name: `${activeTeam.name} Activities Tracker`,
        browser_tab_name: `${activeTeam.name} Activities`,
      }
    }

    const { data, error } = await supabase.from('settings').select('*').limit(1)

    if (error) throw error

    if (data && data.length > 0) {
      return {
        ...DEFAULT_SETTINGS,
        ...data[0],
      } as Settings
    }

    return DEFAULT_SETTINGS
  } catch (error) {
    console.error('Error fetching settings:', error)
    throw error
  }
}

export async function updateSettings(settings: Partial<Settings>, userId: string, team?: Team | null) {
  try {
    if (!shouldUseLegacyTables(team)) {
      const activeTeam = getActiveTeamOrLegacy(team)
      const { data, error } = await supabase
        .from('team_settings')
        .upsert(
          [
            {
              ...DEFAULT_SETTINGS,
              ...settings,
              team_id: activeTeam.id,
              updated_at: new Date().toISOString(),
              updated_by: userId,
            },
          ],
          { onConflict: 'team_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data as Settings
    }

    const { data: existing, error: existingError } = await supabase
      .from('settings')
      .select('id')
      .limit(1)

    if (existingError) throw existingError

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', existing[0].id)
        .select()

      if (error) throw error
      return data?.[0] as Settings | undefined
    }

    const { data, error } = await supabase
      .from('settings')
      .insert([
        {
          ...DEFAULT_SETTINGS,
          ...settings,
          updated_by: userId,
        },
      ])
      .select()

    if (error) throw error
    return data?.[0] as Settings | undefined
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
      .in('role', ['admin', 'superadmin'])
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
  try {
    const [{ data: teams, error: teamsError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        supabase
          .from('app_teams')
          .select('id, name, slug, uses_legacy_tables, is_active, created_at')
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
      uses_legacy_tables: team.uses_legacy_tables === true,
      is_active: team.is_active !== false,
      member_count: memberCounts[team.id] || 0,
    }))
  } catch (error) {
    if (!isTeamSchemaMissingError(error)) {
      throw error
    }

    return [
      {
        ...LEGACY_AUTOMATION_TEAM,
        uses_legacy_tables: true,
        is_active: true,
        member_count: 0,
      },
    ]
  }
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
    .insert([{ name, slug, uses_legacy_tables: false }])
    .select('id, name, slug, uses_legacy_tables, is_active, created_at')
    .single<TeamRow>()

  if (error) {
    throw error
  }

  await supabase.from('team_settings').insert([
    {
      team_id: data.id,
      webapp_name: `${data.name} Activities Tracker`,
      browser_tab_name: `${data.name} Activities`,
    },
  ])

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
    .select('id, name, slug, uses_legacy_tables, is_active, created_at')
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

  if (team.slug === 'automation') {
    throw new Error('Automation is the primary migrated team and cannot be deleted.')
  }

  const { error } = await supabase.from('app_teams').delete().eq('id', teamId)

  if (error) {
    throw error
  }
}

export async function getManagedUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, permissions, is_approved, approved_at, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data || []).map((user) => normalizeManagedUser(user as UserProfileRow))
}

export async function getTeamManagedUsers(): Promise<TeamManagedUser[]> {
  const users = await getManagedUsers()

  try {
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
  } catch (error) {
    if (!isTeamSchemaMissingError(error)) {
      throw error
    }

    return users.map((user) => ({
      ...user,
      team_ids: [LEGACY_AUTOMATION_TEAM.id],
      team_roles: { [LEGACY_AUTOMATION_TEAM.id]: user.role },
    }))
  }
}

export async function setUserTeamMembership(input: {
  userId: string
  teamId: string
  enabled: boolean
  role?: UserRole
}) {
  if (input.teamId === LEGACY_AUTOMATION_TEAM.id) {
    return
  }

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
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (input.teamId && input.teamId !== LEGACY_AUTOMATION_TEAM.id && input.role) {
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

  if (input.role && (!input.teamId || input.teamId === LEGACY_AUTOMATION_TEAM.id)) {
    payload.role = input.role
    payload.permissions = normalizePermissions(undefined, input.role)
  }

  if (typeof input.isApproved === 'boolean') {
    payload.is_approved = input.isApproved
    payload.approved_at = input.isApproved ? new Date().toISOString() : null
    payload.approved_by = input.isApproved ? authUser?.id || null : null
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

    const activeTeam = getActiveTeamOrLegacy(team)
    let query = shouldUseLegacyTables(team)
      ? supabase.from('activities').select('*')
      : supabase.from('team_activities').select('*').eq('team_id', activeTeam.id)
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

    if (filters.activityType) {
      query = query.eq('activityType', filters.activityType)
    }

    if (filters.hasMoc) {
      query = query.ilike('comments', '%{MOC}%')
    }

    const data = await fetchAllActivitiesBatched(() =>
      query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    )

    let results = (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      results = results.filter((activity) =>
        [
          activity.date,
          formatDateForDisplay(activity.date),
          activity.performer,
          activity.system,
          activity.activityType,
          getActivityTypeLabel(activity.activityType),
          activity.tag,
          activity.problem,
          activity.action,
          activity.comments ?? '',
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
