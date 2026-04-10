import React, { useState, useEffect } from 'react'
import { ActivityForm } from './components/ActivityForm'
import { ActivityList } from './components/ActivityList'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { AccountSettings } from './components/AccountSettings'
import { SearchFilter } from './components/SearchFilter'
import {
  Activity,
  User,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  searchActivities,
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'add' | 'search'>('dashboard')
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [searchApplied, setSearchApplied] = useState(false)

  useEffect(() => {
    if (currentUser) {
      // Persist user to localStorage
      localStorage.setItem('currentUser', JSON.stringify(currentUser))
      loadActivities()
    }
  }, [currentUser])

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
        // When editing, keep original performer and add editedBy
        const updateData: Partial<Activity> = {
          ...activity,
          performer: editingData?.performer || activity.performer,
          editedBy: currentUser?.name,
        }
        await updateActivity(editingId, updateData)
        setMessage({ type: 'success', text: 'Activity updated successfully!' })
        // Clear editing state first
        setEditingId(null)
        setEditingData(undefined)
      } else {
        // When adding, set performer to current user
        const activityWithPerformer = {
          ...activity,
          performer: currentUser?.name || activity.performer,
        }
        await createActivity(activityWithPerformer)
        setMessage({ type: 'success', text: 'Activity added successfully!' })
      }
      await loadActivities()
    } catch (error) {
      setMessage({
        type: 'error',
        text: editingId ? 'Failed to update activity' : 'Failed to add activity',
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditActivity = (activity: Activity) => {
    setEditingId(activity.id!)
    setEditingData(activity)
    setCurrentView('add')
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
    <div className="container">
      <div className="header">
        <div className="header-content">
          <div>
            <h1>📋 Daily Activities Tracker</h1>
            <p>Track your daily work activities with problems, actions, and comments</p>
          </div>
          <div className="header-user">
            <p>Welcome, <strong>{currentUser.name}</strong></p>
            <div className="header-buttons">
              <button className="btn btn-secondary" onClick={() => setShowAccountSettings(true)}>
                ⚙️ Settings
              </button>
              <button className="btn btn-logout" onClick={handleLogout}>
                Logout
              </button>
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

      {/* Navigation Tabs */}
      <div className="navigation-tabs">
        <button
          className={`tab-button ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-button ${currentView === 'add' ? 'active' : ''}`}
          onClick={() => setCurrentView('add')}
        >
          ➕ Add Activity
        </button>
        <button
          className={`tab-button ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => setCurrentView('search')}
        >
          🔍 Search Activities
        </button>
      </div>

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <div className="dashboard-section-main">
          <Dashboard activities={activities} performerName={currentUser.name} />
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
    </div>
  )
}

export default App
