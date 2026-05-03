import { getAppViewStorageKey, isPersistedAppView, resolveAccessibleView } from './viewPreferences'

describe('view preferences', () => {
  it('builds a user-and-team scoped storage key', () => {
    expect(getAppViewStorageKey('user-1', 'team-1')).toBe('app-current-view:user-1:team-1')
  })

  it('validates supported app views', () => {
    expect(isPersistedAppView('search')).toBe(true)
    expect(isPersistedAppView('settings')).toBe(false)
  })

  it('falls back to an accessible view when the stored view is no longer allowed', () => {
    expect(
      resolveAccessibleView('import', {
        canViewDashboard: false,
        canAddActivity: false,
        canSearch: true,
        canImport: false,
        canExport: false,
      })
    ).toBe('search')
  })
})
