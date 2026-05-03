export type PersistedAppView = 'dashboard' | 'add' | 'search' | 'import' | 'export'
type ViewAccess = {
  canViewDashboard: boolean
  canAddActivity: boolean
  canSearch: boolean
  canImport: boolean
  canExport: boolean
}

const APP_VIEW_STORAGE_PREFIX = 'app-current-view'
const VALID_APP_VIEWS: PersistedAppView[] = ['dashboard', 'add', 'search', 'import', 'export']

export function isPersistedAppView(value: string): value is PersistedAppView {
  return VALID_APP_VIEWS.includes(value as PersistedAppView)
}

export function getAppViewStorageKey(userId: string, teamId: string) {
  return `${APP_VIEW_STORAGE_PREFIX}:${userId}:${teamId || '__no-team__'}`
}

export function readPersistedAppView(userId: string, teamId: string) {
  if (typeof window === 'undefined' || !userId) {
    return null
  }

  const raw = window.localStorage.getItem(getAppViewStorageKey(userId, teamId))
  return raw && isPersistedAppView(raw) ? raw : null
}

export function writePersistedAppView(userId: string, teamId: string, view: PersistedAppView) {
  if (typeof window === 'undefined' || !userId) {
    return
  }

  window.localStorage.setItem(getAppViewStorageKey(userId, teamId), view)
}

export function resolveAccessibleView(preferredView: PersistedAppView, permissions: ViewAccess): PersistedAppView {
  if (preferredView === 'dashboard') {
    return permissions.canViewDashboard ? 'dashboard' : permissions.canSearch ? 'search' : permissions.canExport ? 'export' : 'dashboard'
  }

  if (preferredView === 'add') {
    return permissions.canAddActivity ? 'add' : permissions.canViewDashboard ? 'dashboard' : permissions.canSearch ? 'search' : 'export'
  }

  if (preferredView === 'search') {
    return permissions.canSearch ? 'search' : permissions.canViewDashboard ? 'dashboard' : permissions.canExport ? 'export' : 'dashboard'
  }

  if (preferredView === 'import') {
    return permissions.canImport ? 'import' : permissions.canViewDashboard ? 'dashboard' : permissions.canSearch ? 'search' : 'export'
  }

  return permissions.canExport ? 'export' : permissions.canViewDashboard ? 'dashboard' : permissions.canSearch ? 'search' : 'dashboard'
}
