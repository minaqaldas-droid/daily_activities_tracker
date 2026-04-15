import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Activity {
  id?: string
  date: string
  performer: string
  system: string
  instrument: string
  problem: string
  action: string
  comments: string
  editedBy?: string
  created_at?: string
}

export interface User {
  id?: string
  email: string
  name: string
  password?: string
  role?: 'user' | 'superadmin'
  created_at?: string
}

export interface Settings {
  id?: string
  webapp_name: string
  logo_url: string
  primary_color?: string
  updated_at?: string
  updated_by?: string
}

export interface AuthSession {
  user: User | null
  isAuthenticated: boolean
}

export async function getActivities() {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching activities:', error)
    throw error
  }
}

export async function createActivity(activity: Activity) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([activity])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (error) {
    console.error('Error creating activity:', error)
    throw error
  }
}

export async function updateActivity(id: string, activity: Partial<Activity>) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(activity)
      .eq('id', id)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (error) {
    console.error('Error updating activity:', error)
    throw error
  }
}

export async function deleteActivity(id: string) {
  try {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting activity:', error)
    throw error
  }
}

// Authentication functions
export async function signUp(email: string, name: string, password: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, name, password }])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (error) {
    console.error('Error signing up:', error)
    throw error
  }
}

export async function login(email: string, password: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Invalid email or password')
    }
    return data[0]
  } catch (error) {
    console.error('Error logging in:', error)
    throw error
  }
}

export async function getUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')

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
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user activities:', error)
    throw error
  }
}

export async function updateUserDetails(userId: string, name: string, email: string, password: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ name, email, password })
      .eq('id', userId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

// Settings functions (Superadmin only)
export async function getSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)

    if (error) throw error
    
    // Return first settings record or default
    if (data && data.length > 0) {
      return data[0]
    }
    
    // Return default settings if no record exists
    return {
      webapp_name: 'Daily Activities Tracker',
      logo_url: '',
      primary_color: '#667eea'
    }
  } catch (error) {
    console.error('Error fetching settings:', error)
    throw error
  }
}

export async function updateSettings(settings: Partial<Settings>, userId: string) {
  try {
    // First, check if settings exist
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing
      const { data, error } = await supabase
        .from('settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', existing[0].id)
        .select()

      if (error) throw error
      return data?.[0]
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('settings')
        .insert([{
          ...settings,
          updated_by: userId
        }])
        .select()

      if (error) throw error
      return data?.[0]
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    throw error
  }
}

export async function getSuperadminUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'superadmin')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching superadmin users:', error)
    throw error
  }
}

// Search functions
export async function searchActivities(filters: {
  date?: string
  startDate?: string
  endDate?: string
  performer?: string
  instrument?: string
  system?: string
  keyword?: string
}) {
  try {
    let query = supabase.from('activities').select('*')

    if (filters.startDate && filters.endDate) {
      query = query.gte('date', filters.startDate).lte('date', filters.endDate)
    } else if (filters.date) {
      query = query.eq('date', filters.date)
    }

    if (filters.performer) {
      query = query.ilike('performer', `%${filters.performer}%`)
    }

    if (filters.instrument) {
      query = query.ilike('instrument', `%${filters.instrument}%`)
    }

    if (filters.system) {
      query = query.eq('system', filters.system)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Client-side keyword search across all fields
    let results = data || []
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      results = results.filter(
        (activity) =>
          activity.date.toLowerCase().includes(keyword) ||
          activity.performer.toLowerCase().includes(keyword) ||
          activity.system.toLowerCase().includes(keyword) ||
          activity.instrument.toLowerCase().includes(keyword) ||
          activity.problem.toLowerCase().includes(keyword) ||
          activity.action.toLowerCase().includes(keyword) ||
          activity.comments.toLowerCase().includes(keyword) ||
          (activity.editedBy && activity.editedBy.toLowerCase().includes(keyword))
      )
    }

    return results
  } catch (error) {
    console.error('Error searching activities:', error)
    throw error
  }
}
