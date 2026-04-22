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
}

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
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
  role: 'user' | 'admin' | 'superadmin' | null
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
  role: 'user' | 'admin'
  permissions: FeaturePermissions
  is_approved: boolean
  approved_at?: string | null
  created_at?: string
}

interface UpdateManagedUserInput {
  email?: string
  name?: string
  role?: 'user' | 'admin'
  permissions?: FeaturePermissions
  isApproved?: boolean
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

export const DEFAULT_USER_PERMISSIONS: FeaturePermissions = {
  dashboard: true,
  add: false,
  edit: false,
  search: true,
  import: false,
  export: true,
  edit_action: false,
  delete_action: false,
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

export function normalizePermissions(
  permissions: Partial<FeaturePermissions> | null | undefined,
  role: User['role']
): FeaturePermissions {
  const base = role === 'admin' ? ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS

  return {
    ...base,
    ...(permissions || {}),
  }
}

export function hasPermission(user: User | null | undefined, feature: FeatureKey) {
  if (!user) {
    return false
  }

  if (user.role === 'admin') {
    return true
  }

  const normalized = normalizePermissions(user.permissions, user.role)
  return Boolean(normalized[feature])
}

function getMetadataAvatar(authUser: SupabaseAuthUser) {
  const metadataAvatar =
    typeof authUser.user_metadata?.avatar_url === 'string'
      ? authUser.user_metadata.avatar_url.trim()
      : ''

  return metadataAvatar
}

function normalizeUserProfile(profile: UserProfileRow, avatarUrl?: string): User {
  const normalizedRole = profile.role === 'admin' || profile.role === 'superadmin' ? 'admin' : 'user'
  const normalizedAvatar = (avatarUrl || profile.avatar_url || '').trim()
  const normalizedPrimaryColor = (profile.preferred_primary_color || '').trim()
  const normalizedPermissions = normalizePermissions(profile.permissions, normalizedRole)
  const isApproved = profile.is_approved !== false

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: normalizedRole,
    avatar_url: normalizedAvatar || undefined,
    preferred_primary_color: normalizedPrimaryColor || undefined,
    permissions: normalizedPermissions,
    is_approved: isApproved,
    approved_at: profile.approved_at ?? null,
    created_at: profile.created_at,
  }
}

function normalizeManagedUser(profile: UserProfileRow): AdminManagedUser {
  const normalizedRole = profile.role === 'admin' || profile.role === 'superadmin' ? 'admin' : 'user'
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

async function getUserProfileById(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, avatar_url, preferred_primary_color, permissions, is_approved, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle<UserProfileRow>()

  if (error) {
    throw error
  }

  return data ? normalizeUserProfile(data) : null
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
  const existingProfile = await getUserProfileById(authUser.id)
  const metadataAvatar = getMetadataAvatar(authUser)
  const desiredProfile: User = {
    id: authUser.id,
    email: authUser.email ?? existingProfile?.email ?? '',
    name: existingProfile?.name || getMetadataName(authUser),
    role: existingProfile?.role ?? 'user',
    avatar_url: metadataAvatar || existingProfile?.avatar_url,
    preferred_primary_color: existingProfile?.preferred_primary_color || '',
    permissions: normalizePermissions(existingProfile?.permissions, existingProfile?.role || 'user'),
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
  return {
    ...updatedProfile,
    avatar_url: desiredProfile.avatar_url,
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
  }
}

function matchesSearchFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => Boolean(value))
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

export async function getActivities() {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((activity) => normalizeActivity(activity as Partial<Activity>))
  } catch (error) {
    console.error('Error fetching activities:', error)
    throw error
  }
}

export async function createActivity(activity: Activity) {
  try {
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

export async function createActivities(activities: Activity[]) {
  try {
    if (activities.length === 0) {
      return 0
    }

    const { error } = await supabase.from('activities').insert(activities.map(getFormattedActivity))

    if (error) throw error
    return activities.length
  } catch (error) {
    console.error('Error bulk creating activities:', error)
    throw error
  }
}

export async function updateActivity(id: string, activity: Partial<Activity>) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update({
        ...activity,
        comments: activity.comments ?? '',
      })
      .eq('id', id)
      .select()

    if (error) {
      const errorMessage = error.message || JSON.stringify(error)
      throw new Error(`Update failed: ${errorMessage}`)
    }

    return data?.[0] ? normalizeActivity(data[0] as Partial<Activity>) : undefined
  } catch (error) {
    console.error('Error updating activity:', error)
    throw error
  }
}

export async function deleteActivity(id: string) {
  try {
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

export async function getActivitiesByUser(userName: string) {
  try {
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

    return {
      user: normalizeUserProfile(updatedProfile, getMetadataAvatar(updatedAuthUser) || trimmedAvatarUrl),
      emailChangePending,
      pendingEmail: emailChangePending ? trimmedEmail : undefined,
    }
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

export async function getSettings() {
  try {
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

export async function updateSettings(settings: Partial<Settings>, userId: string) {
  try {
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

export async function createManagedUser(input: {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  permissions?: FeaturePermissions
}) {
  const permissions = normalizePermissions(input.permissions, input.role)

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

  if (typeof input.email === 'string') {
    payload.email = input.email.trim()
  }

  if (typeof input.name === 'string') {
    payload.name = input.name.trim()
  }

  if (input.role) {
    payload.role = input.role
  }

  if (input.permissions) {
    payload.permissions = normalizePermissions(input.permissions, input.role || 'user')
  }

  if (typeof input.isApproved === 'boolean') {
    payload.is_approved = input.isApproved
    payload.approved_at = input.isApproved ? new Date().toISOString() : null
    payload.approved_by = input.isApproved ? authUser?.id || null : null
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

export async function searchActivities(filters: SearchFilters) {
  try {
    if (!matchesSearchFilters(filters)) {
      return getActivities()
    }

    let query = supabase.from('activities').select('*')
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

    const { data, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

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
          activity.editedBy ?? '',
        ].some((field) => String(field).toLowerCase().includes(keyword))
      )
    }

    return results
  } catch (error) {
    console.error('Error searching activities:', error)
    throw error
  }
}
