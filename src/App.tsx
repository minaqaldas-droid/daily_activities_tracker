import React, { useState, useEffect } from 'react'
import { ActivityForm } from './components/ActivityForm'
import { ActivityList } from './components/ActivityList'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { AccountSettings } from './components/AccountSettings'
import { SuperAdminPanel } from './components/SuperAdminPanel'
import { SearchFilter } from './components/SearchFilter'
import { ExcelImport } from './components/ExcelImport'
import { ExcelExport } from './components/ExcelExport'
import { Sidebar } from './components/Sidebar'
import {
  Activity,
  User,
  Settings,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  searchActivities,
  getSettings,
} from './supabaseClient'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Check localStorage on initial load
    const saved = localStorage.getItem('currentUser')
    return saved ? JSON.parse(saved) : null
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Activity | undefined>(undefined)
  const [currentView, setCurrentView] = useState<'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export'>('dashboard')
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false)
  const [searchApplied, setSearchApplied] = useState(false)
  const [settings, setSettings] = useState<Settings>({
    webapp_name: 'Daily Activities Tracker',
    logo_url: '',
    primary_color: '#667eea',
    performer_mode: 'manual',
  })

  useEffect(() => {
    if (currentUser) {
      // Persist user to localStorage
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
      loadActivities()
      loadSettings()
    }
  }, [currentUser])

  const loadSettings = async () => {
    try {
      const appSettings = await getSettings()
      setSettings(appSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  useEffect(() => {
    // Update filtered activities when activities change
    setFilteredActivities(activities)
  }, [activities])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    // Apply primary color to document root
    if (settings.primary_color) {
      document.documentElement.style.setProperty('--primary-color', settings.primary_color)
    }
  }, [settings.primary_color])

  const loadActivities = async () => {
    try {
      setIsLoading(true)
      const data = await getActivities()
      setActivities(data)
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load activities. Make sure Supabase is configured.',
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddOrUpdateActivity = async (activity: Activity) => {
    try {
      setIsLoading(true)
      if (editingId) {
        // When editing, only update fields that should be changed (exclude id, created_at)
        const updateData = {
          date: activity.date,
          performer: editingData?.performer || activity.performer,
          system: activity.system,
          instrument: activity.instrument,
          problem: activity.problem,
          action: activity.action,
          comments: activity.comments,
          editedBy: currentUser?.name,
        }
        await updateActivity(editingId, updateData)
        setMessage({ type: 'success', text: 'Activity updated successfully!' })
        // Clear editing state first
        setEditingId(null)
        setEditingData(undefined)
      } else {
        // When adding, handle performer based on the mode
        let performerName = activity.performer
        if (settings.performer_mode === 'auto') {
          // In auto mode, use logged-in user
          performerName = currentUser?.name || activity.performer
        }
        // In manual mode, use the performer from the form
        const activityWithPerformer = {
          ...activity,
          performer: performerName,
        }
        await createActivity(activityWithPerformer)
        setMessage({ type: 'success', text: 'Activity added successfully!' })
      }
      await loadActivities()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessage({
        type: 'error',
        text: editingId ? `Failed to update activity: ${errorMessage}` : `Failed to add activity: ${errorMessage}`,
      })
      console.error('Full error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditActivity = (activity: Activity) => {
    setEditingId(activity.id!)
    setEditingData(activity)
    setCurrentView('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      setIsLoading(true)
      await deleteActivity(id)
      setMessage({ type: 'success', text: 'Activity deleted successfully!' })
      await loadActivities()
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete activity' })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (filters: { date?: string; performer?: string; instrument?: string }) => {
    try {
      setIsLoading(true)
      if (!filters.date && !filters.performer && !filters.instrument) {
        setFilteredActivities(activities)
        setSearchApplied(false)
      } else {
        const results = await searchActivities(filters)
        setFilteredActivities(results)
        setSearchApplied(true)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to search activities',
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser)
    setMessage({ type: 'success', text: 'Account updated successfully!' })
  }

  const handleLogout = () => {
    // Clear user from localStorage
    localStorage.removeItem('currentUser')
    setCurrentUser(null)
    setActivities([])
    setFilteredActivities([])
    setEditingId(null)
    setEditingData(undefined)
    setCurrentView('dashboard')
    setShowAccountSettings(false)
    setMessage({ type: 'success', text: 'Logged out successfully!' })
  }

  // Show login form if user is not authenticated
  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={setCurrentView}
        onSettingsClick={() => setShowAccountSettings(true)}
        onAdminClick={() => setShowSuperAdminPanel(true)}
        onLogout={handleLogout}
      />

      <div className="main-content">
        <div className="header">
          <div className="header-content">
            <div className="header-logo-section">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="App Logo" className="app-logo" onError={() => {}} />
              )}
              <div>
                <h1>{settings.webapp_name}</h1>
                <p>Track your daily work activities with problems, actions, and comments</p>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className={`${message.type === 'success' ? 'success-message' : 'error-message'}`}>
            {message.text}
          </div>
        )}

        {/* Account Settings Modal */}
        {showAccountSettings && (
          <AccountSettings
            user={currentUser}
            onUpdateSuccess={handleUpdateUser}
            onClose={() => setShowAccountSettings(false)}
            isLoading={isLoading}
          />
        )}

        {/* Superadmin Settings Modal */}
        {showSuperAdminPanel && currentUser.role === 'superadmin' && (
          <SuperAdminPanel
            user={currentUser}
            currentSettings={settings}
            onClose={() => setShowSuperAdminPanel(false)}
            onSettingsUpdate={(newSettings) => {
              setSettings(newSettings)
              setMessage({ type: 'success', text: 'Settings updated successfully!' })
            }}
            isLoading={isLoading}
          />
        )}

        <div className="content-wrapper">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div className="dashboard-section-main">
              <Dashboard 
                activities={activities} 
                performerName={currentUser.name} 
                onEdit={handleEditActivity}
                onDelete={handleDeleteActivity}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Add Activity View */}
          {currentView === 'add' && (
            <>
              <div className="form-section">
                <h2>
                  {editingId ? '✏️ Edit Activity' : '➕ Add New Activity'}
                </h2>
                <ActivityForm
                  onSubmit={handleAddOrUpdateActivity}
                  initialData={editingData}
                  isLoading={isLoading}
                  performerMode={settings.performer_mode || 'manual'}
                  currentUserName={currentUser?.name}
                />
                {editingId && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(null)
                      setEditingData(undefined)
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="list-section">
                <h2>📝 Recent Activities</h2>
                <ActivityList
                  activities={activities.slice(0, 10)}
                  onEdit={handleEditActivity}
                  onDelete={handleDeleteActivity}
                  isLoading={isLoading}
                />
              </div>
            </>
          )}

          {/* Edit Activity View */}
          {currentView === 'edit' && editingId && editingData ? (
            <>
              <div className="form-section">
                <h2>✏️ Edit Activity</h2>
                <ActivityForm
                  onSubmit={handleAddOrUpdateActivity}
                  initialData={editingData}
                  isLoading={isLoading}
                  performerMode={settings.performer_mode || 'manual'}
                  currentUserName={currentUser?.name}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingId(null)
                    setEditingData(undefined)
                    setCurrentView('dashboard')
                  }}
                  style={{ marginTop: '10px' }}
                >
                  ← Back to Dashboard
                </button>
              </div>

              <div className="list-section">
                <h2>📝 All Activities</h2>
                <ActivityList
                  activities={activities}
                  onEdit={handleEditActivity}
                  onDelete={handleDeleteActivity}
                  isLoading={isLoading}
                />
              </div>
            </>
          ) : currentView === 'edit' ? (
            <div className="empty-state">
              <p>No activity selected for editing. Please edit an activity from the Dashboard or Search.</p>
              <button
                className="btn btn-primary"
                onClick={() => setCurrentView('dashboard')}
              >
                ← Go to Dashboard
              </button>
            </div>
          ) : null}

          {/* Search Activity View */}
          {currentView === 'search' && (
            <>
              <div className="search-section">
                <SearchFilter onSearch={handleSearch} isLoading={isLoading} />
              </div>

              {searchApplied && (
                <div className="search-info">
                  Found {filteredActivities.length} activity(ies)
                </div>
              )}

              <div className="list-section">
                <h2>📝 Search Results ({filteredActivities.length})</h2>
                <ActivityList
                  activities={filteredActivities}
                  onEdit={handleEditActivity}
                  onDelete={handleDeleteActivity}
                  isLoading={isLoading}
                />
              </div>
            </>
          )}

          {/* Import Excel View */}
          {currentView === 'import' && (
            <ExcelImport
              onImportSuccess={(count) => {
                setMessage({
                  type: 'success',
                  text: `Successfully imported ${count} activities!`,
                })
                loadActivities()
              }}
              onImportError={(error) => {
                setMessage({
                  type: 'error',
                  text: `Import failed: ${error}`,
                })
              }}
              isLoading={isLoading}
              currentUserName={currentUser?.name}
            />
          )}

          {/* Export Excel View */}
          {currentView === 'export' && (
            <ExcelExport
              activities={activities}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
