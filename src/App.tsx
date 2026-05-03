import React, { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { AccountSettings } from './components/AccountSettings'
import { ActivityForm } from './components/ActivityForm'
import { ActivityList } from './components/ActivityList'
import { ActivityResultsPopup } from './components/ActivityResultsPopup'
import {
  Dashboard,
  type DashboardActivityRequest,
} from './components/Dashboard'
import { Login } from './components/Login'
import { SearchFilter } from './components/SearchFilter'
import { Sidebar } from './components/Sidebar'
import { AdminPanel } from './components/SuperAdminPanel'
import { UserManagementModal } from './components/UserManagementModal'
import { useActivities } from './hooks/useActivities'
import { useAuth } from './hooks/useAuth'
import { useDashboardActivities } from './hooks/useDashboardActivities'
import { useSettings } from './hooks/useSettings'
import {
  getActivitiesForDashboardFilter,
  hasPermission,
  type Activity,
  type SearchFilters,
  type Settings,
  type Team,
  type User,
} from './supabaseClient'
import { formatDateForDisplay } from './utils/date'
import { getDashboardChartDefinitions } from './utils/dashboardCharts'
import { matchesActivityKeyword } from './utils/activityKeywordSearch'
import { readPersistedAppView, resolveAccessibleView, writePersistedAppView } from './utils/viewPreferences'
import {
  applyDashboardChartDisplayCountOverrides,
  readDashboardChartDisplayCountOverrides,
  writeDashboardChartDisplayCountOverrides,
  type DashboardChartDisplayCountOverrides,
} from './utils/dashboardChartPreferences'
import { type DashboardResultsFilter } from './types/activityResults'

const ExcelImport = lazy(() =>
  import('./components/ExcelImport').then((module) => ({ default: module.ExcelImport }))
)

const ExcelExport = lazy(() =>
  import('./components/ExcelExport').then((module) => ({ default: module.ExcelExport }))
)

type AppView = 'dashboard' | 'add' | 'search' | 'import' | 'export'
type AppMessage = { type: 'success' | 'error'; text: string } | null

const APP_VIEW_LABELS: Record<AppView, string> = {
  dashboard: 'Dashboard',
  add: 'Add Activity',
  search: 'Search',
  import: 'Import Excel',
  export: 'Export Excel',
}

interface ResultsPopupState {
  title: string
  description: string
  activities: Activity[]
  exportFilename: string
  filter?: ResultsPopupFilter
  isLoading?: boolean
}

type ResultsPopupFilter = DashboardResultsFilter | { kind: 'search'; filters: SearchFilters }

const MOBILE_NAV_MEDIA_QUERY = '(max-width: 768px)'
const EDIT_RESTRICTED_MESSAGE = 'Only Admin users can edit activities.'
const DELETE_RESTRICTED_MESSAGE = 'Only Admin users can delete activities.'
const IMPORT_RESTRICTED_MESSAGE = 'Only Admin users can access Excel import.'
const ADD_RESTRICTED_MESSAGE = 'Only Admin users can add activities.'

function hasSearchFilters(filters: SearchFilters) {
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'customFields') {
      return Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, string>).length > 0)
    }

    return Boolean(value)
  })
}

function includesIgnoreCase(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.toLowerCase())
}

function matchesSearchFiltersForActivity(activity: Activity, filters: SearchFilters, settings?: Settings | null) {
  if (!hasSearchFilters(filters)) {
    return true
  }

  if (filters.date && activity.date !== filters.date) {
    return false
  }

  if (!filters.date) {
    if (filters.startDate && activity.date < filters.startDate) {
      return false
    }

    if (filters.endDate && activity.date > filters.endDate) {
      return false
    }
  }

  if (filters.performer && !includesIgnoreCase(activity.performer || '', filters.performer)) {
    return false
  }

  if (filters.tag && !includesIgnoreCase(activity.tag || '', filters.tag)) {
    return false
  }

  if (filters.system && (activity.system || '') !== filters.system) {
    return false
  }

  if (filters.shift && (activity.shift || '') !== filters.shift) {
    return false
  }

  if (filters.permitNumber && !includesIgnoreCase(activity.permitNumber || '', filters.permitNumber)) {
    return false
  }

  if (filters.instrumentType && !includesIgnoreCase(activity.instrumentType || '', filters.instrumentType)) {
    return false
  }

  if (filters.problem && !includesIgnoreCase(activity.problem || '', filters.problem)) {
    return false
  }

  if (filters.action && !includesIgnoreCase(activity.action || '', filters.action)) {
    return false
  }

  if (filters.comments && !includesIgnoreCase(activity.comments || '', filters.comments)) {
    return false
  }

  if (filters.customFields) {
    const hasCustomFieldMismatch = Object.entries(filters.customFields).some(
      ([fieldKey, fieldValue]) => {
        if (typeof fieldValue === 'boolean') {
          const checkboxLabel = filters.checkboxLabels?.[fieldKey]
          const hasStoredValue = String(activity.customFields?.[fieldKey] || '').toLowerCase() === 'true'
          const hasCommentToken = Boolean(checkboxLabel && includesIgnoreCase(activity.comments || '', `{${checkboxLabel}}`))
          return fieldValue ? !hasStoredValue && !hasCommentToken : false
        }

        return Boolean(fieldValue && !includesIgnoreCase(activity.customFields?.[fieldKey] || '', fieldValue))
      }
    )

    if (hasCustomFieldMismatch) {
      return false
    }
  }

  if (filters.activityType && (activity.activityType || '') !== filters.activityType) {
    return false
  }

  if (filters.hasMoc && !String(activity.comments || '').toLowerCase().includes('{moc}')) {
    return false
  }

  if (filters.keyword) {
    if (!matchesActivityKeyword(activity, filters.keyword, settings)) {
      return false
    }
  }

  return true
}

function matchesResultsPopupFilter(activity: Activity, filter?: ResultsPopupFilter, settings?: Settings | null) {
  if (!filter) {
    return true
  }

  switch (filter.kind) {
    case 'search':
      return matchesSearchFiltersForActivity(activity, filter.filters, settings)
    case 'all':
      return true
    case 'performer':
      return (activity.performer || '') === filter.performer
    case 'performerIn':
      return filter.performers.includes(activity.performer || '')
    case 'hasField':
      return Boolean((activity[filter.field] || '').trim())
    case 'fieldHasValue':
      return Boolean(String(activity.customFields?.[filter.fieldKey] || activity[filter.fieldKey as keyof Activity] || '').trim())
    case 'fieldValue':
      return String(activity.customFields?.[filter.fieldKey] || activity[filter.fieldKey as keyof Activity] || '') === filter.fieldValue
    case 'recentlyEdited':
      return Boolean(String(activity.edited_at || '').trim())
    case 'sinceDate':
      return (activity.date || '') >= filter.sinceDate
    case 'activityType':
      return (activity.activityType || '') === filter.activityType
    case 'system':
      return (activity.system || '') === filter.system
    case 'shift':
      return (activity.shift || '') === filter.shift
    case 'instrumentType':
      return (activity.instrumentType || '') === filter.instrumentType
    case 'tag':
      return (activity.tag || '') === filter.tag
    default:
      return true
  }
}

function App() {
  const { currentUser, isAuthLoading, login, signUp, logout, setCurrentUser } = useAuth()
  const [activeTeam, setActiveTeam] = useState<Team | null>(null)
  const effectiveActiveTeam = activeTeam || currentUser?.active_team || null
  const activeTeamId = activeTeam?.id || currentUser?.active_team?.id || ''
  const activeMembership = useMemo(
    () => currentUser?.team_memberships?.find((membership) => membership.team.id === activeTeamId),
    [activeTeamId, currentUser?.team_memberships]
  )
  const appUser: User | null = useMemo(
    () =>
      currentUser
        ? {
            ...currentUser,
            role: currentUser.is_superadmin ? 'admin' : activeMembership?.role || currentUser.role,
            permissions: currentUser.is_superadmin
              ? currentUser.permissions
              : activeMembership?.permissions || currentUser.permissions,
            active_team: effectiveActiveTeam || undefined,
          }
        : null,
    [activeMembership, currentUser, effectiveActiveTeam]
  )
  const { settings, setSettings, effectivePrimaryColor } = useSettings(
    Boolean(appUser),
    appUser?.preferred_primary_color || '',
    effectiveActiveTeam
  )
  const {
    activities,
    latestActivities,
    filteredActivities,
    isLoading,
    loadActivities,
    loadRecentActivities,
    removeActivity,
    resetActivities,
    runSearch,
    saveActivity,
    searchApplied,
  } = useActivities({
    currentUserName: appUser?.name,
    performerMode: settings.performer_mode || 'manual',
    activeTeam: effectiveActiveTeam,
    settings,
  })
  const {
    summaryActivities,
    recentActivities,
    isLoading: isDashboardLoading,
    loadDashboardActivities,
    invalidateDashboardActivities,
    resetDashboardActivities,
  } = useDashboardActivities(effectiveActiveTeam)

  const [message, setMessage] = useState<AppMessage>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Activity | undefined>(undefined)
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [resultsPopup, setResultsPopup] = useState<ResultsPopupState | null>(null)
  const resultsPopupRequestIdRef = useRef(0)
  const [lastSearchFilters, setLastSearchFilters] = useState<SearchFilters>({})
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia(MOBILE_NAV_MEDIA_QUERY).matches
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [dashboardChartDisplayCountOverrides, setDashboardChartDisplayCountOverrides] = useState<DashboardChartDisplayCountOverrides>({})

  useEffect(() => {
    if (!currentUser) {
      setActiveTeam(null)
      resetActivities()
      resetDashboardActivities()
      setEditingId(null)
      setEditingData(undefined)
      setCurrentView('dashboard')
      setShowAccountSettings(false)
      setShowAdminPanel(false)
      setShowUserManagement(false)
      setResultsPopup(null)
      setIsMobileSidebarOpen(false)
      setDashboardChartDisplayCountOverrides({})
      return
    }

    setActiveTeam((previousTeam) => {
      const availableTeams = currentUser.team_memberships?.map((membership) => membership.team) || []
      if (previousTeam && availableTeams.some((team) => team.id === previousTeam.id)) {
        return previousTeam
      }

      return currentUser.active_team || availableTeams[0] || null
    })
  }, [currentUser, resetActivities, resetDashboardActivities])

  useEffect(() => {
    if (!appUser) {
      setDashboardChartDisplayCountOverrides({})
      return
    }

    setDashboardChartDisplayCountOverrides(
      readDashboardChartDisplayCountOverrides(appUser.id, effectiveActiveTeam?.id || '')
    )
  }, [appUser, effectiveActiveTeam?.id])

  useEffect(() => {
    if (!currentUser || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [currentUser?.id])

  useEffect(() => {
    if (!appUser) {
      return
    }

    let isMounted = true

    void loadDashboardActivities().catch((error) => {
      if (!isMounted) {
        return
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to load activities. Make sure Supabase is configured correctly.'
      const noTeamMessage = 'No active team is selected. Assign the user to a team and try again.'

      setMessage({
        type: 'error',
        text:
          errorMessage === noTeamMessage
            ? 'Your account is not assigned to a team yet. Ask an admin to assign a team, or run the team-membership repair migration.'
            : errorMessage,
      })
    })

    return () => {
      isMounted = false
    }
  }, [appUser, loadDashboardActivities])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!appUser || currentView !== 'export') {
      return
    }

    void loadActivities().catch((error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to prepare activities for export.',
      })
    })
  }, [appUser, currentView, loadActivities])

  useEffect(() => {
    if (!appUser || currentView !== 'search' || !effectiveActiveTeam) {
      return
    }

    void runSearch(searchApplied ? lastSearchFilters : {}).catch((error) => {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to refresh search activities.',
      })
    })
  }, [appUser, currentView, effectiveActiveTeam?.id, runSearch])

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
    if (typeof window === 'undefined') {
      return
    }

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 360)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key !== 'Escape') {
        return
      }

      if (editingId && editingData) {
        handleCancelEdit()
        return
      }

      if (resultsPopup) {
        setResultsPopup(null)
        return
      }

      if (showUserManagement) {
        setShowUserManagement(false)
        return
      }

      if (showAdminPanel) {
        setShowAdminPanel(false)
        return
      }

      if (showAccountSettings) {
        setShowAccountSettings(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingData, editingId, resultsPopup, showAccountSettings, showAdminPanel, showUserManagement])

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const isAnyModalOpen =
      Boolean(resultsPopup) ||
      Boolean(editingId && editingData) ||
      showAccountSettings ||
      showAdminPanel ||
      showUserManagement

    document.body.classList.toggle('modal-open', isAnyModalOpen)

    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [editingData, editingId, resultsPopup, showAccountSettings, showAdminPanel, showUserManagement])

  const isAdmin = appUser?.role === 'admin'
  const canViewDashboard = hasPermission(appUser, 'dashboard')
  const canAddActivity = hasPermission(appUser, 'add')
  const canSearch = hasPermission(appUser, 'search')
  const canImport = hasPermission(appUser, 'import')
  const canExport = hasPermission(appUser, 'export')
  const canEditAction = hasPermission(appUser, 'edit_action')
  const canDeleteAction = hasPermission(appUser, 'delete_action')
  const dashboardSettings = useMemo(
    () => applyDashboardChartDisplayCountOverrides(settings, dashboardChartDisplayCountOverrides),
    [dashboardChartDisplayCountOverrides, settings]
  )

  useEffect(() => {
    if (!appUser) {
      return
    }

    const restoredView = readPersistedAppView(appUser.id, effectiveActiveTeam?.id || '')
    if (!restoredView) {
      return
    }

    setCurrentView(
      resolveAccessibleView(restoredView, {
        canViewDashboard,
        canAddActivity,
        canSearch,
        canImport,
        canExport,
      })
    )
  }, [appUser, canAddActivity, canExport, canImport, canSearch, canViewDashboard, effectiveActiveTeam?.id])

  useEffect(() => {
    if (!appUser) {
      return
    }

    writePersistedAppView(appUser.id, effectiveActiveTeam?.id || '', currentView)
  }, [appUser, currentView, effectiveActiveTeam?.id])

  const handleBackToTop = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const buildSearchResultsPopup = (
    sourceActivities: Activity[],
    filters: SearchFilters = lastSearchFilters
  ): ResultsPopupState => ({
    title: '🔎 Search Results',
    description: `Showing ${sourceActivities.length} activit${sourceActivities.length === 1 ? 'y' : 'ies'} matching the current filters.`,
    activities: sourceActivities,
    exportFilename: 'Search_Results.xlsx',
    filter: { kind: 'search', filters },
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
        refreshMode: currentView === 'export' ? 'full' : 'recent',
      })
      invalidateDashboardActivities()
      void loadDashboardActivities().catch((error) => {
        console.error('Error refreshing dashboard activities after save:', error)
      })

      setMessage({
        type: 'success',
        text: isEditing ? 'Activity updated successfully.' : 'Activity added successfully.',
      })

      if (isEditing) {
        const editedActivityId = editingId || editingData?.id || activity.id || ''
        const editedActivity: Activity = {
          ...(editingData || {}),
          ...activity,
          id: editedActivityId || activity.id,
        }

        if (editedActivityId) {
          setResultsPopup((prev) => {
            if (!prev) {
              return prev
            }

            const itemIndex = prev.activities.findIndex((item) => item.id === editedActivityId)
            if (itemIndex === -1) {
              return prev
            }

            if (!matchesResultsPopupFilter(editedActivity, prev.filter, settings)) {
              return {
                ...prev,
                activities: prev.activities.filter((item) => item.id !== editedActivityId),
              }
            }

            const nextActivities = [...prev.activities]
            nextActivities[itemIndex] = {
              ...nextActivities[itemIndex],
              ...editedActivity,
            }

            return {
              ...prev,
              activities: nextActivities,
            }
          })
        }

        setEditingId(null)
        setEditingData(undefined)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save activity.',
      })
    }
  }

  const handleEditActivity = (activity: Activity) => {
    if (!canEditAction) {
      setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })
      return
    }

    setEditingId(activity.id || null)
    setEditingData(activity)
  }

  const handleDeleteActivity = async (id: string) => {
    if (!canDeleteAction) {
      setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })
      return
    }

    try {
      await removeActivity(id, currentView === 'export' ? 'full' : 'recent')
      invalidateDashboardActivities()
      void loadDashboardActivities().catch((error) => {
        console.error('Error refreshing dashboard activities after delete:', error)
      })
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
      setLastSearchFilters(filters)
      const requestId = resultsPopupRequestIdRef.current + 1
      resultsPopupRequestIdRef.current = requestId

      if (hasSearchFilters(filters)) {
        setResultsPopup({
          ...buildSearchResultsPopup([], filters),
          description: 'Loading activities matching the current filters...',
          isLoading: true,
        })
      } else {
        setResultsPopup(null)
      }

      const results = await runSearch(filters)

      if (hasSearchFilters(filters) && requestId === resultsPopupRequestIdRef.current) {
        setResultsPopup(buildSearchResultsPopup(results, filters))
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
  }

  const handleSettingsUpdate = (newSettings: Settings) => {
    setSettings(newSettings)
    setMessage({ type: 'success', text: 'Settings updated successfully.' })
  }

  const handleDashboardChartDisplayCountChange = (chartKey: string, maxItems: number) => {
    if (!appUser) {
      return
    }

    const currentChart = getDashboardChartDefinitions(dashboardSettings).find((chart) => chart.key === chartKey)
    if (!currentChart) {
      return
    }

    setDashboardChartDisplayCountOverrides((previous) => {
      const nextOverrides = {
        ...previous,
        [chartKey]: maxItems,
      }
      writeDashboardChartDisplayCountOverrides(appUser.id, effectiveActiveTeam?.id || '', nextOverrides)
      return nextOverrides
    })
  }

  const handleOpenDashboardResults = async (request: DashboardActivityRequest) => {
    const requestId = resultsPopupRequestIdRef.current + 1
    resultsPopupRequestIdRef.current = requestId

    setResultsPopup({
      title: request.title,
      description: request.description,
      activities: request.activities || [],
      exportFilename: request.exportFilename || `${request.title.replace(/\s+/g, '_')}.xlsx`,
      filter: request.filter,
      isLoading: Boolean(request.filter),
    })

    try {
      const popupActivities =
        request.filter
          ? await getActivitiesForDashboardFilter(request.filter, effectiveActiveTeam)
          : request.activities || []

      if (requestId !== resultsPopupRequestIdRef.current) {
        return
      }

      setResultsPopup({
        title: request.title,
        description: request.description,
        activities: popupActivities,
        exportFilename: request.exportFilename || `${request.title.replace(/\s+/g, '_')}.xlsx`,
        filter: request.filter,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load dashboard activities.',
      })
      setResultsPopup((previous) => {
        if (!previous || previous.filter !== request.filter) {
          return previous
        }

        return { ...previous, isLoading: false }
      })
    }
  }

  const handleSidebarToggle = () => {
    if (!isMobileViewport) {
      setIsSidebarExpanded((value) => !value)
    }
  }

  const handleViewChange = (view: AppView) => {
    setResultsPopup(null)
    setIsMobileSidebarOpen(false)

    if (view === 'dashboard' && !canViewDashboard) {
      setMessage({ type: 'error', text: 'You do not have permission to access Dashboard.' })
      return
    }

    if (view === 'import' && !canImport) {
      setMessage({ type: 'error', text: IMPORT_RESTRICTED_MESSAGE })
      return
    }

    if (view === 'add' && !canAddActivity) {
      setMessage({ type: 'error', text: ADD_RESTRICTED_MESSAGE })
      return
    }

    if (view === 'search' && !canSearch) {
      setMessage({ type: 'error', text: 'You do not have permission to access Search.' })
      return
    }

    if (view === 'export' && !canExport) {
      setMessage({ type: 'error', text: 'You do not have permission to access Export.' })
      return
    }

    if (view === 'search') {
      setCurrentView(view)
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

  if (!appUser) {
    return null
  }

  const latestSearchActivities = latestActivities
  const searchResultsPopupState = buildSearchResultsPopup(filteredActivities, lastSearchFilters)
  const currentViewLabel = APP_VIEW_LABELS[currentView]

  return (
    <div className={`app-layout ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <Sidebar
        currentUser={appUser}
        teams={currentUser.team_memberships?.map((membership) => membership.team) || []}
        activeTeamId={effectiveActiveTeam?.id || appUser.active_team?.id || ''}
        onTeamChange={(teamId) => {
          const nextTeam = currentUser.team_memberships?.find((membership) => membership.team.id === teamId)?.team
          if (nextTeam) {
            startTransition(() => {
              setActiveTeam(nextTeam)
            })
            setResultsPopup(null)
            setEditingId(null)
            setEditingData(undefined)
          }
        }}
        currentView={currentView}
        onViewChange={handleViewChange}
        isExpanded={isSidebarExpanded}
        isMobileViewport={isMobileViewport}
        isMobileOpen={isMobileSidebarOpen}
        onToggleExpanded={handleSidebarToggle}
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
                  activities={summaryActivities}
                  recentActivities={recentActivities}
                  performerName={appUser.name}
                  activeTeam={effectiveActiveTeam}
                  settings={dashboardSettings}
                  onEdit={handleEditActivity}
                  onDelete={handleDeleteActivity}
                  isLoading={isLoading || isDashboardLoading}
                  canEdit={canEditAction}
                  canDelete={canDeleteAction}
                  onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
                  onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
                  onOpenActivityResults={handleOpenDashboardResults}
                  canManageChartDisplayCounts={isAdmin}
                  onUpdateChartDisplayCount={handleDashboardChartDisplayCountChange}
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
                  currentUserName={appUser.name}
                  activeTeam={effectiveActiveTeam}
                  settings={settings}
                />
              </div>
            )}

            {currentView === 'search' && (
              <>
                <div className="search-section">
                  <SearchFilter
                    onSearch={handleSearch}
                    isLoading={isLoading}
                    activeTeam={effectiveActiveTeam}
                    settings={settings}
                  />
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
                      activeTeam={effectiveActiveTeam}
                      settings={settings}
                      isLoading={isLoading}
                    canEdit={canEditAction}
                    canDelete={canDeleteAction}
                    onEditDenied={() => setMessage({ type: 'error', text: EDIT_RESTRICTED_MESSAGE })}
                    onDeleteDenied={() => setMessage({ type: 'error', text: DELETE_RESTRICTED_MESSAGE })}
                    emptyMessage="No activities available yet."
                  />
                  </div>
                )}
              </>
            )}

            {currentView === 'import' && !canImport && (
              <div className="form-section permission-notice">
                <h2>Excel Import Restricted</h2>
                <p>Only Admin users can import activities from Excel files.</p>
                <button className="btn btn-secondary" onClick={() => setCurrentView('dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            )}

            {currentView === 'import' && canImport && (
              <Suspense
                fallback={
                  <div className="form-section">
                    <p>Loading import tools...</p>
                  </div>
                }
              >
                <ExcelImport
                  activeTeam={effectiveActiveTeam}
                  settings={settings}
                  onImportSuccess={({ importedCount, skippedCount }) => {
                    setMessage({
                      type: 'success',
                      text:
                        skippedCount > 0
                          ? `Imported ${importedCount} activit${importedCount === 1 ? 'y' : 'ies'}. ${skippedCount} row${skippedCount === 1 ? ' was' : 's were'} skipped and should be reviewed.`
                          : `Successfully imported ${importedCount} activit${importedCount === 1 ? 'y' : 'ies'}.`,
                    })
                    invalidateDashboardActivities()
                    void Promise.all([loadRecentActivities(), loadDashboardActivities()]).catch((error) => {
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
                <ExcelExport
                  activities={activities}
                  activeTeam={effectiveActiveTeam}
                  settings={settings}
                  isLoading={isLoading}
                />
              </Suspense>
            )}
          </div>
        </div>

        {showAccountSettings && (
          <AccountSettings
            user={appUser}
            onUpdateSuccess={handleUpdateUser}
            onClose={() => setShowAccountSettings(false)}
            isLoading={isLoading}
            currentPrimaryColor={effectivePrimaryColor}
          />
        )}

        {showAdminPanel && appUser.role === 'admin' && (
          <AdminPanel
            user={appUser}
            activeTeam={effectiveActiveTeam}
            currentSettings={settings}
            onClose={() => setShowAdminPanel(false)}
            onSettingsUpdate={handleSettingsUpdate}
            onOpenUserManagement={() => setShowUserManagement(true)}
            isLoading={isLoading}
          />
        )}

        {showUserManagement && appUser.is_superadmin && (
          <UserManagementModal
            currentUser={appUser}
            activeTeam={effectiveActiveTeam}
            onTeamsChanged={(deletedTeamId) => {
              if (deletedTeamId) {
                setCurrentUser((previous) => {
                  if (!previous) {
                    return previous
                  }

                  const nextMemberships =
                    previous.team_memberships?.filter((membership) => membership.team.id !== deletedTeamId) || []
                  const nextActiveTeam =
                    previous.active_team?.id === deletedTeamId
                      ? nextMemberships[0]?.team
                      : previous.active_team

                  return {
                    ...previous,
                    active_team: nextActiveTeam,
                    team_memberships: nextMemberships,
                  }
                })
                setActiveTeam((previous) => (previous?.id === deletedTeamId ? null : previous))
              }
            }}
            onClose={() => setShowUserManagement(false)}
          />
        )}

        {editingId && editingData && (
          <div className="modal-overlay edit-activity-overlay" onClick={handleCancelEdit}>
            <div
              className="settings-modal edit-activity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-activity-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 id="edit-activity-modal-title">Edit Activity</h2>
                <button className="modal-close" onClick={handleCancelEdit} aria-label="Close edit activity modal">
                  ×
                </button>
              </div>
              <div className="edit-activity-body">
                <ActivityForm
                  onSubmit={handleAddOrUpdateActivity}
                  initialData={editingData}
                  isLoading={isLoading}
                  performerMode={settings.performer_mode || 'manual'}
                  currentUserName={appUser.name}
                  activeTeam={effectiveActiveTeam}
                  settings={settings}
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`back-to-top-button ${showBackToTop ? 'visible' : ''}`}
          onClick={handleBackToTop}
          aria-label="Back to top"
          title="Back to top"
        >
          ↑
        </button>

        <ActivityResultsPopup
          isOpen={Boolean(resultsPopup)}
          title={resultsPopup?.title || ''}
          description={resultsPopup?.description}
          activities={resultsPopup?.activities || []}
          exportFilename={resultsPopup?.exportFilename}
          activeTeam={effectiveActiveTeam}
          settings={settings}
          onClose={() => setResultsPopup(null)}
          onEdit={handleEditActivity}
          onDelete={handleDeleteActivity}
          isLoading={isLoading || Boolean(resultsPopup?.isLoading)}
          canEdit={canEditAction}
          canDelete={canDeleteAction}
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
