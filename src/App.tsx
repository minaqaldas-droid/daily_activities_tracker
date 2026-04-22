import React, { Suspense, lazy, useEffect, useState } from 'react'
import { AccountSettings } from './components/AccountSettings'
import { ActivityForm } from './components/ActivityForm'
import { ActivityList } from './components/ActivityList'
import { ActivityResultsPopup } from './components/ActivityResultsPopup'
import { Dashboard, type DashboardActivityRequest } from './components/Dashboard'
import { Login } from './components/Login'
import { SearchFilter } from './components/SearchFilter'
import { Sidebar } from './components/Sidebar'
import { AdminPanel } from './components/SuperAdminPanel'
import { useActivities } from './hooks/useActivities'
import { useAuth } from './hooks/useAuth'
import { useSettings } from './hooks/useSettings'
import { type Activity, type SearchFilters, type Settings, type User } from './supabaseClient'

const ExcelImport = lazy(() =>
  import('./components/ExcelImport').then((module) => ({ default: module.ExcelImport }))
)

const ExcelExport = lazy(() =>
  import('./components/ExcelExport').then((module) => ({ default: module.ExcelExport }))
)

type AppView = 'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export'
type AppMessage = { type: 'success' | 'error'; text: string } | null

const APP_VIEW_LABELS: Record<AppView, string> = {
  dashboard: 'Dashboard',
  add: 'Add Activity',
  edit: 'Edit Activity',
  search: 'Search',
  import: 'Import Excel',
  export: 'Export Excel',
}

interface ResultsPopupState {
  title: string
  description: string
  activities: Activity[]
  exportFilename: string
}

const MOBILE_NAV_MEDIA_QUERY = '(max-width: 768px)'
const EDIT_RESTRICTED_MESSAGE = 'Only Admin users can edit activities.'
const DELETE_RESTRICTED_MESSAGE = 'Only Admin users can delete activities.'
const IMPORT_RESTRICTED_MESSAGE = 'Only Admin users can access Excel import.'
const ADD_RESTRICTED_MESSAGE = 'Only Admin users can add activities.'

function hasSearchFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => Boolean(value))
}

function App() {
  const { currentUser, isAuthLoading, login, signUp, logout, setCurrentUser } = useAuth()
  const { settings, setSettings, effectivePrimaryColor, setPreferredPrimaryColor } = useSettings(Boolean(currentUser))
  const {
    activities,
    filteredActivities,
    isLoading,
    loadActivities,
    removeActivity,
    resetActivities,
    runSearch,
    saveActivity,
    searchApplied,
  } = useActivities({
    currentUserName: currentUser?.name,
    performerMode: settings.performer_mode || 'manual',
  })

  const [message, setMessage] = useState<AppMessage>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Activity | undefined>(undefined)
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [resultsPopup, setResultsPopup] = useState<ResultsPopupState | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia(MOBILE_NAV_MEDIA_QUERY).matches
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      resetActivities()
      setEditingId(null)
      setEditingData(undefined)
      setCurrentView('dashboard')
      setShowAccountSettings(false)
      setShowAdminPanel(false)
      setResultsPopup(null)
      setIsMobileSidebarOpen(false)
      return
    }

    let isMounted = true

    void loadActivities().catch((error) => {
      if (!isMounted) {
        return
      }

      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to load activities. Make sure Supabase is configured correctly.',
      })
    })

    return () => {
      isMounted = false
    }
  }, [currentUser, loadActivities, resetActivities])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_NAV_MEDIA_QUERY)
    const handleViewportChange = (matches: boolean) => {
      setIsMobileViewport(matches)

      if (!matches) {
        setIsMobileSidebarOpen(false)
      }
    }

    handleViewportChange(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      handleViewportChange(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  useEffect(() => {
    if (!isMobileViewport || !isMobileSidebarOpen || typeof window === 'undefined') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileSidebarOpen, isMobileViewport])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.body.classList.toggle('app-shell-active', Boolean(currentUser))
    document.body.classList.toggle(
      'mobile-nav-open',
      Boolean(currentUser) && isMobileViewport && isMobileSidebarOpen
    )

    return () => {
      document.body.classList.remove('app-shell-active')
      document.body.classList.remove('mobile-nav-open')
    }
  }, [currentUser, isMobileSidebarOpen, isMobileViewport])

  const isAdmin = currentUser?.role === 'admin'

  const buildSearchResultsPopup = (sourceActivities: Activity[]): ResultsPopupState => ({
    title: '🔎 Search Results',
    description: `Showing ${sourceActivities.length} activit${sourceActivities.length === 1 ? 'y' : 'ies'} matching the current filters.`,
    activities: sourceActivities,
    exportFilename: 'Search_Results.xlsx',
  })

  const handleLogin = async (email: string, password: string) => {
    await login(email, password)
    setMessage({ type: 'success', text: 'Logged in successfully.' })
  }

  const handleSignUp = async (email: string, name: string, password: string) => {
    const result = await signUp(email, name, password)

    if (result.user) {
      setMessage({ type: 'success', text: 'Account created successfully.' })
    }

    return result
  }

  const handleAddOrUpdateActivity = async (activity: Activity) => {
    const isEditing = Boolean(editingId)

    try {
      await saveActivity(activity, {
        editingId,
        editingData,
      })

      setMessage({
        type: 'success',
        text: isEditing ? 'Activity updated successfully.' : 'Activity added successfully.',
      })

      if (isEditing) {
        setEditingId(null)
        setEditingData(undefined)
        setCurrentView('dashboard')
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save activity.',
      })
    }
  }

  const handleEditActivity = (activity: Activity) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })
      return
    }

    setResultsPopup(null)
    setEditingId(activity.id || null)
    setEditingData(activity)
    setCurrentView('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteActivity = async (id: string) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })
      return
    }

    try {
      await removeActivity(id)
      setResultsPopup((prev) =>
        prev
          ? {
              ...prev,
              activities: prev.activities.filter((activity) => activity.id !== id),
            }
          : null
      )
      setMessage({ type: 'success', text: 'Activity deleted successfully.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete activity.',
      })
    }
  }

  const handleSearch = async (filters: SearchFilters) => {
    try {
      const results = await runSearch(filters)

      if (hasSearchFilters(filters)) {
        setResultsPopup(buildSearchResultsPopup(results))
      } else {
        setResultsPopup(null)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to search activities.',
      })
    }
  }

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser)
    setMessage({ type: 'success', text: 'Account updated successfully.' })
  }

  const handleLogout = async () => {
    try {
      await logout()
      setMessage({ type: 'success', text: 'Logged out successfully.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to log out.',
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingData(undefined)
    setCurrentView('dashboard')
  }

  const handleSettingsUpdate = (newSettings: Settings) => {
    setSettings(newSettings)
    setMessage({ type: 'success', text: 'Settings updated successfully.' })
  }

  const handleOpenDashboardResults = (request: DashboardActivityRequest) => {
    setResultsPopup({
      title: request.title,
      description: request.description,
      activities: request.activities,
      exportFilename: request.exportFilename || `${request.title.replace(/\s+/g, '_')}.xlsx`,
    })
  }

  const handleSidebarHoverExtend = () => {
    if (!isMobileViewport) {
      setIsSidebarExpanded(true)
    }
  }

  const handleSidebarHoverLeave = () => {
    if (!isMobileViewport) {
      setIsSidebarExpanded(false)
    }
  }

  const handleViewChange = (view: AppView) => {
    setResultsPopup(null)
    setIsMobileSidebarOpen(false)

    if (view === 'import' && !isAdmin) {
      setMessage({ type: 'error', text: IMPORT_RESTRICTED_MESSAGE })
      return
    }

    if (view === 'add' && !isAdmin) {
      setMessage({ type: 'error', text: ADD_RESTRICTED_MESSAGE })
      return
    }

    if (view === 'edit' && !isAdmin) {
      setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })
      return
    }

    if (view === 'search') {
      setCurrentView(view)
      void runSearch({})
        .then(() => {
          setResultsPopup(null)
        })
        .catch((error) => {
          setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Failed to prepare latest activities.',
          })
        })
      return
    }

    setCurrentView(view)
  }

  if (isAuthLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Daily Activities Tracker</h1>
          <p className="auth-subtitle">Restoring your session...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} onSignUp={handleSignUp} />
  }

  const latestSearchActivities = activities.slice(0, 10)
  const searchResultsPopupState = buildSearchResultsPopup(filteredActivities)
  const currentViewLabel = APP_VIEW_LABELS[currentView]

  return (
    <div className={`app-layout ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={handleViewChange}
        isExpanded={isSidebarExpanded}
        isMobileViewport={isMobileViewport}
        isMobileOpen={isMobileSidebarOpen}
        onHoverExtend={handleSidebarHoverExtend}
        onHoverLeave={handleSidebarHoverLeave}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onSettingsClick={() => {
          setIsMobileSidebarOpen(false)
          setShowAccountSettings(true)
        }}
        onAdminClick={() => {
          setIsMobileSidebarOpen(false)
          setShowAdminPanel(true)
        }}
        onLogout={handleLogout}
      />

      {isMobileViewport && isMobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <div className="main-content">
        <div className="main-content-shell">
          <div className="header">
            <div className="app-toolbar">
              <button
                type="button"
                className="app-toolbar-button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-controls="primary-sidebar"
                aria-expanded={isMobileSidebarOpen}
              >
                Menu
              </button>

              <div className="app-toolbar-copy">
                <div className="app-toolbar-brand">
                  {settings.logo_url && (
                    <img
                      src={settings.logo_url}
                      alt="App Logo"
                      className="app-toolbar-logo"
                      onError={() => {}}
                    />
                  )}
                  <span className="app-toolbar-label">{settings.webapp_name}</span>
                </div>
                <strong>{currentViewLabel}</strong>
              </div>

              <span className="app-toolbar-badge">{currentViewLabel}</span>
            </div>

            <div className="header-content">
              <div className="header-logo-section">
                {settings.logo_url && (
                  <img src={settings.logo_url} alt="App Logo" className="app-logo" onError={() => {}} />
                )}
                <div>
                  <h1>{settings.webapp_name}</h1>
                  <p>Track your daily work activities.</p>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
              {message.text}
            </div>
          )}

          <div className="content-wrapper">
            {currentView === 'dashboard' && (
              <div className="dashboard-section-main">
                <Dashboard
                  activities={activities}
                  performerName={currentUser.name}
                  onEdit={handleEditActivity}
                  onDelete={handleDeleteActivity}
                  isLoading={isLoading}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
                  onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
                  onOpenActivityResults={handleOpenDashboardResults}
                />
              </div>
            )}

            {currentView === 'add' && (
              <div className="form-section">
                <h2>➕ Add New Activity</h2>
                <ActivityForm
                  onSubmit={handleAddOrUpdateActivity}
                  isLoading={isLoading}
                  performerMode={settings.performer_mode || 'manual'}
                  currentUserName={currentUser.name}
                />
              </div>
            )}

            {currentView === 'edit' && editingId && editingData ? (
              <>
                <div className="form-section">
                  <h2>📝 Edit Activity</h2>
                  <ActivityForm
                    onSubmit={handleAddOrUpdateActivity}
                    initialData={editingData}
                    isLoading={isLoading}
                    performerMode={settings.performer_mode || 'manual'}
                    currentUserName={currentUser.name}
                  />
                  <button className="btn btn-secondary" onClick={handleCancelEdit} style={{ marginTop: '10px' }}>
                    Back to Dashboard
                  </button>
                </div>

                <div className="list-section">
                  <h2>📋 Latest 10 Activities</h2>
                  <ActivityList
                    activities={activities.slice(0, 10)}
                    onEdit={handleEditActivity}
                    onDelete={handleDeleteActivity}
                    isLoading={isLoading}
                    canEdit={isAdmin}
                    canDelete={isAdmin}
                    onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
                    onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
                  />
                </div>
              </>
            ) : currentView === 'edit' ? (
              <div className="empty-state">
                <p>No activity selected for editing. Choose one from the dashboard or search results.</p>
                <div className="empty-state-actions">
                  <button className="btn btn-primary" onClick={() => handleViewChange('dashboard')}>
                    Go to Dashboard
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleViewChange('search')}>
                    Go to Search
                  </button>
                </div>
              </div>
            ) : null}

            {currentView === 'search' && (
              <>
                <div className="search-section">
                  <SearchFilter onSearch={handleSearch} isLoading={isLoading} />
                </div>

                {searchApplied ? (
                  <div className="list-section search-results-launcher">
                    <h2>{searchResultsPopupState.title}</h2>
                    <p>{searchResultsPopupState.description}</p>

                    <div className="search-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setResultsPopup(searchResultsPopupState)}
                      >
                        Reopen Results Popup
                      </button>
                      <span className="search-results-count">
                        {searchResultsPopupState.activities.length} activit
                        {searchResultsPopupState.activities.length === 1 ? 'y' : 'ies'} ready
                      </span>
                    </div>

                    <div className="search-info">
                      Found {filteredActivities.length} activit{filteredActivities.length === 1 ? 'y' : 'ies'}.
                    </div>
                  </div>
                ) : (
                  <div className="list-section">
                    <h2>📋 Latest 10 Activities</h2>
                    <ActivityList
                      activities={latestSearchActivities}
                      onEdit={handleEditActivity}
                      onDelete={handleDeleteActivity}
                      isLoading={isLoading}
                    canEdit={isAdmin}
                    canDelete={isAdmin}
                    onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
                    onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
                    emptyMessage="No activities available yet."
                  />
                  </div>
                )}
              </>
            )}

            {currentView === 'import' && !isAdmin && (
              <div className="form-section permission-notice">
                <h2>Excel Import Restricted</h2>
                <p>Only Admin users can import activities from Excel files.</p>
                <button className="btn btn-secondary" onClick={() => setCurrentView('dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            )}

            {currentView === 'import' && isAdmin && (
              <Suspense
                fallback={
                  <div className="form-section">
                    <p>Loading import tools...</p>
                  </div>
                }
              >
                <ExcelImport
                  onImportSuccess={({ importedCount, skippedCount }) => {
                    setMessage({
                      type: 'success',
                      text:
                        skippedCount > 0
                          ? `Imported ${importedCount} activit${importedCount === 1 ? 'y' : 'ies'}. ${skippedCount} row${skippedCount === 1 ? ' was' : 's were'} skipped and should be reviewed.`
                          : `Successfully imported ${importedCount} activit${importedCount === 1 ? 'y' : 'ies'}.`,
                    })
                    void loadActivities().catch((error) => {
                      console.error('Error refreshing activities after import:', error)
                    })
                  }}
                  onImportError={(error) => {
                    setMessage({
                      type: 'error',
                      text: `Import failed: ${error}`,
                    })
                  }}
                  isLoading={isLoading}
                />
              </Suspense>
            )}

            {currentView === 'export' && (
              <Suspense
                fallback={
                  <div className="form-section">
                    <p>Loading export tools...</p>
                  </div>
                }
              >
                <ExcelExport activities={activities} isLoading={isLoading} />
              </Suspense>
            )}
          </div>
        </div>

        {showAccountSettings && (
          <AccountSettings
            user={currentUser}
            onUpdateSuccess={handleUpdateUser}
            onClose={() => setShowAccountSettings(false)}
            isLoading={isLoading}
            currentPrimaryColor={effectivePrimaryColor}
            onPrimaryColorChange={setPreferredPrimaryColor}
          />
        )}

        {showAdminPanel && currentUser.role === 'admin' && (
          <AdminPanel
            user={currentUser}
            currentSettings={settings}
            onClose={() => setShowAdminPanel(false)}
            onSettingsUpdate={handleSettingsUpdate}
            isLoading={isLoading}
          />
        )}

        <ActivityResultsPopup
          isOpen={Boolean(resultsPopup)}
          title={resultsPopup?.title || ''}
          description={resultsPopup?.description}
          activities={resultsPopup?.activities || []}
          exportFilename={resultsPopup?.exportFilename}
          onClose={() => setResultsPopup(null)}
          onEdit={handleEditActivity}
          onDelete={handleDeleteActivity}
          isLoading={isLoading}
          canEdit={isAdmin}
          canDelete={isAdmin}
          onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
          onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
          onExportSuccess={(text) => setMessage({ type: 'success', text })}
          onExportError={(text) =>
            setMessage({
              type: 'error',
              text: text.startsWith('Failed') ? text : `Export failed: ${text}`,
            })
          }
        />
      </div>
    </div>
  )
}

export default App
