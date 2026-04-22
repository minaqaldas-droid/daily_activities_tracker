import React, { useEffect, useMemo, useState } from 'react'
import {
  type AdminManagedUser,
  type Settings,
  type User,
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
  updateManagedUser,
  updateSettings,
} from '../supabaseClient'

interface AdminPanelProps {
  user: User
  currentSettings: Settings
  onClose: () => void
  onSettingsUpdate: (settings: Settings) => void
  isLoading?: boolean
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  currentSettings,
  onClose,
  onSettingsUpdate,
  isLoading = false,
}) => {
  const [webappName, setWebappName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [browserTabName, setBrowserTabName] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#667eea')
  const [performerMode, setPerformerMode] = useState<'manual' | 'auto'>('manual')
  const [headerFontFamily, setHeaderFontFamily] = useState('')
  const [headerFontSize, setHeaderFontSize] = useState('2.5rem')
  const [subheaderFontFamily, setSubheaderFontFamily] = useState('')
  const [subheaderFontSize, setSubheaderFontSize] = useState('1.5rem')
  const [sidebarFontFamily, setSidebarFontFamily] = useState('')
  const [sidebarFontSize, setSidebarFontSize] = useState('0.95rem')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [managedUsers, setManagedUsers] = useState<AdminManagedUser[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [usersSearch, setUsersSearch] = useState('')
  const [newUserId, setNewUserId] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user')
  const [isUserMutationLoading, setIsUserMutationLoading] = useState(false)

  useEffect(() => {
    setWebappName(currentSettings.webapp_name || 'Daily Activities Tracker')
    setLogoUrl(currentSettings.logo_url || '')
    setBrowserTabName(currentSettings.browser_tab_name || currentSettings.webapp_name || 'Daily Activities Tracker')
    setFaviconUrl(currentSettings.favicon_url || '')
    setPrimaryColor(currentSettings.primary_color || '#667eea')
    setPerformerMode(currentSettings.performer_mode || 'manual')
    setHeaderFontFamily(currentSettings.header_font_family || '')
    setHeaderFontSize(currentSettings.header_font_size || '2.5rem')
    setSubheaderFontFamily(currentSettings.subheader_font_family || '')
    setSubheaderFontSize(currentSettings.subheader_font_size || '1.5rem')
    setSidebarFontFamily(currentSettings.sidebar_font_family || '')
    setSidebarFontSize(currentSettings.sidebar_font_size || '0.95rem')
  }, [currentSettings])

  const loadManagedUsers = async () => {
    try {
      setIsUsersLoading(true)
      const users = await getManagedUsers()
      setManagedUsers(users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setIsUsersLoading(false)
    }
  }

  useEffect(() => {
    void loadManagedUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!usersSearch.trim()) {
      return managedUsers
    }

    const keyword = usersSearch.toLowerCase()
    return managedUsers.filter((managedUser) =>
      [managedUser.name, managedUser.email, managedUser.role, managedUser.id]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [managedUsers, usersSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!webappName.trim()) {
      setError('Webapp name is required.')
      return
    }

    try {
      setIsSubmitting(true)

      const updatedSettings = await updateSettings(
        {
          webapp_name: webappName.trim(),
          logo_url: logoUrl.trim(),
          browser_tab_name: browserTabName.trim(),
          favicon_url: faviconUrl.trim(),
          primary_color: primaryColor,
          performer_mode: performerMode,
          header_font_family: headerFontFamily.trim(),
          header_font_size: headerFontSize.trim(),
          subheader_font_family: subheaderFontFamily.trim(),
          subheader_font_size: subheaderFontSize.trim(),
          sidebar_font_family: sidebarFontFamily.trim(),
          sidebar_font_size: sidebarFontSize.trim(),
        },
        user.id
      )

      if (updatedSettings) {
        setSuccess('Admin settings updated successfully.')
        onSettingsUpdate(updatedSettings)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleManagedUserCreate = async () => {
    setError('')
    setSuccess('')

    if (!newUserId.trim() || !newUserEmail.trim() || !newUserName.trim()) {
      setError('User ID, email, and name are required to create or link a user.')
      return
    }

    try {
      setIsUserMutationLoading(true)
      const createdUser = await createManagedUser({
        id: newUserId.trim(),
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        role: newUserRole,
      })
      setManagedUsers((previous) => {
        const withoutCurrent = previous.filter((existing) => existing.id !== createdUser.id)
        return [...withoutCurrent, createdUser]
      })
      setSuccess('User profile created/linked successfully.')
      setNewUserId('')
      setNewUserEmail('')
      setNewUserName('')
      setNewUserRole('user')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create/link user profile.')
    } finally {
      setIsUserMutationLoading(false)
    }
  }

  const handleManagedUserUpdate = async (managedUser: AdminManagedUser, role: 'user' | 'admin') => {
    if (managedUser.role === role) {
      return
    }

    try {
      setIsUserMutationLoading(true)
      const updated = await updateManagedUser(managedUser.id, { role })
      setManagedUsers((previous) => previous.map((item) => (item.id === updated.id ? updated : item)))
      setSuccess(`Updated role for ${managedUser.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user role.')
    } finally {
      setIsUserMutationLoading(false)
    }
  }

  const handleManagedUserDelete = async (managedUser: AdminManagedUser) => {
    if (!confirm(`Delete user profile "${managedUser.name}"?`)) {
      return
    }

    try {
      setIsUserMutationLoading(true)
      await deleteManagedUser(managedUser.id)
      setManagedUsers((previous) => previous.filter((item) => item.id !== managedUser.id))
      setSuccess(`Deleted profile for ${managedUser.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user profile.')
    } finally {
      setIsUserMutationLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="settings-modal">
        <div className="modal-header">
          <h2>Admin Settings</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-group">
            <label htmlFor="webapp-name">In-App Name</label>
            <input
              id="webapp-name"
              type="text"
              value={webappName}
              onChange={(e) => setWebappName(e.target.value)}
              placeholder="Enter in-app brand name"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="logo-url">In-App Logo URL</label>
            <input
              id="logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="browser-tab-name">Browser Tab Name</label>
            <input
              id="browser-tab-name"
              type="text"
              value={browserTabName}
              onChange={(e) => setBrowserTabName(e.target.value)}
              placeholder="Daily Activities Tracker"
              disabled={isSubmitting || isLoading}
            />
            <span className="form-hint">Separate from in-app branding.</span>
          </div>

          <div className="form-group">
            <label htmlFor="favicon-url">Favicon URL</label>
            <input
              id="favicon-url"
              type="url"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              placeholder="https://example.com/favicon.png"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="primary-color">Primary Color</label>
            <div className="color-input-group">
              <input
                id="primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#667eea"
                disabled={isSubmitting || isLoading}
                className="color-hex-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Performer Name Handling</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="performer-mode"
                  value="manual"
                  checked={performerMode === 'manual'}
                  onChange={() => setPerformerMode('manual')}
                  disabled={isSubmitting || isLoading}
                />
                <span className="radio-label">
                  <strong>Manual Entry</strong> Users can choose or type performer name.
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="performer-mode"
                  value="auto"
                  checked={performerMode === 'auto'}
                  onChange={() => setPerformerMode('auto')}
                  disabled={isSubmitting || isLoading}
                />
                <span className="radio-label">
                  <strong>Auto-assign</strong> Use signed-in user as performer.
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Typography: Headers</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={headerFontFamily}
                onChange={(e) => setHeaderFontFamily(e.target.value)}
                placeholder="e.g. Poppins, sans-serif"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={headerFontSize}
                onChange={(e) => setHeaderFontSize(e.target.value)}
                placeholder="e.g. 2.5rem"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Typography: Subheaders</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={subheaderFontFamily}
                onChange={(e) => setSubheaderFontFamily(e.target.value)}
                placeholder="e.g. Lato, sans-serif"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={subheaderFontSize}
                onChange={(e) => setSubheaderFontSize(e.target.value)}
                placeholder="e.g. 1.5rem"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Typography: Sidebar</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={sidebarFontFamily}
                onChange={(e) => setSidebarFontFamily(e.target.value)}
                placeholder="e.g. Inter, sans-serif"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={sidebarFontSize}
                onChange={(e) => setSidebarFontSize(e.target.value)}
                placeholder="e.g. 0.95rem"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting || isLoading}>
              Close
            </button>
          </div>
        </form>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <div className="form-group">
          <label>User Management (CRUD + Roles)</label>
          <div className="form-row form-row-two-up">
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="User UUID"
              disabled={isUserMutationLoading || isUsersLoading}
            />
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={isUserMutationLoading || isUsersLoading}
            />
          </div>
          <div className="form-row form-row-two-up">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Full Name"
              disabled={isUserMutationLoading || isUsersLoading}
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
              disabled={isUserMutationLoading || isUsersLoading}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => void handleManagedUserCreate()} disabled={isUserMutationLoading}>
              Create / Link User
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void loadManagedUsers()} disabled={isUserMutationLoading}>
              Refresh
            </button>
          </div>
          <span className="form-hint">
            Use this after a user signs up (or if you already have a valid auth user UUID) to control role/permissions.
          </span>
        </div>

        <div className="form-group">
          <input
            type="text"
            value={usersSearch}
            onChange={(e) => setUsersSearch(e.target.value)}
            placeholder="Search users by name, email, role, or ID..."
            disabled={isUsersLoading}
          />
        </div>

        <div className="table-container">
          <table className="activities-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>User ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((managedUser) => (
                <tr key={managedUser.id}>
                  <td data-label="Name">{managedUser.name}</td>
                  <td data-label="Email">{managedUser.email}</td>
                  <td data-label="Role">
                    <select
                      value={managedUser.role}
                      onChange={(e) => void handleManagedUserUpdate(managedUser, e.target.value as 'user' | 'admin')}
                      disabled={isUserMutationLoading || isUsersLoading}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td data-label="User ID">
                    <code>{managedUser.id}</code>
                  </td>
                  <td data-label="Actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={isUserMutationLoading || isUsersLoading || managedUser.id === user.id}
                      onClick={() => void handleManagedUserDelete(managedUser)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isUsersLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export const SuperAdminPanel = AdminPanel
