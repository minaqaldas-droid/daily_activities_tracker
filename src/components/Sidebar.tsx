import React, { useEffect, useState } from 'react'
import { type User } from '../supabaseClient'

interface SidebarProps {
  currentUser: User
  currentView: 'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export'
  onViewChange: (view: 'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export') => void
  isExpanded: boolean
  isMobileViewport: boolean
  isMobileOpen: boolean
  onToggleExpand: () => void
  onMobileClose: () => void
  onSettingsClick: () => void
  onAdminClick: () => void
  onLogout: () => void
}

type NavView = SidebarProps['currentView']

const featureItems: Array<{ icon: string; label: string; view: NavView; requiresAdmin?: boolean }> = [
  { icon: '📊', label: 'Dashboard', view: 'dashboard' },
  { icon: '➕', label: 'Add Activity', view: 'add', requiresAdmin: true },
  { icon: '📝', label: 'Edit Activity', view: 'edit', requiresAdmin: true },
  { icon: '🔍', label: 'Search', view: 'search' },
]

const importExportItems: Array<{ icon: string; label: string; view: NavView; requiresAdmin?: boolean }> = [
  { icon: '📥', label: 'Import Excel', view: 'import', requiresAdmin: true },
  { icon: '📤', label: 'Export Excel', view: 'export' },
]

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  onViewChange,
  isExpanded,
  isMobileViewport,
  isMobileOpen,
  onToggleExpand,
  onMobileClose,
  onSettingsClick,
  onAdminClick,
  onLogout,
}) => {
  const isAdmin = currentUser.role === 'admin'
  const [isAvatarBroken, setIsAvatarBroken] = useState(false)

  useEffect(() => {
    setIsAvatarBroken(false)
  }, [currentUser.avatar_url])

  const showAvatarImage = Boolean(currentUser.avatar_url && !isAvatarBroken)
  const userInitial = currentUser.name.trim().charAt(0).toUpperCase() || 'U'
  const toggleLabel = isMobileViewport ? 'Close menu' : isExpanded ? 'Collapse sidebar' : 'Expand sidebar'

  const handleViewSelect = (view: NavView) => {
    onViewChange(view)

    if (isMobileViewport) {
      onMobileClose()
    }
  }

  const handleSettingsSelect = () => {
    onSettingsClick()

    if (isMobileViewport) {
      onMobileClose()
    }
  }

  const handleAdminSelect = () => {
    onAdminClick()

    if (isMobileViewport) {
      onMobileClose()
    }
  }

  const handleLogoutSelect = () => {
    if (isMobileViewport) {
      onMobileClose()
    }

    onLogout()
  }

  return (
    <aside
      id="primary-sidebar"
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'} ${isMobileOpen ? 'mobile-visible' : ''}`}
      aria-label="Primary navigation"
      aria-hidden={isMobileViewport ? !isMobileOpen : undefined}
    >
      <div className="sidebar-mobile-topbar">
        <div className="sidebar-mobile-copy">
          <span className="sidebar-mobile-kicker">Navigation</span>
          <strong>{isAdmin ? 'Admin Menu' : 'Workspace Menu'}</strong>
        </div>
        <button type="button" className="sidebar-mobile-close" onClick={onMobileClose} aria-label="Close navigation menu">
          Close
        </button>
      </div>

      <div
        className="sidebar-header"
        title={`${currentUser.name} (${currentUser.email})${isAdmin ? ' - Admin' : ''}`}
      >
        <div className={`user-avatar ${showAvatarImage ? 'has-image' : ''}`} aria-hidden="true">
          {showAvatarImage ? <img src={currentUser.avatar_url} alt="" onError={() => setIsAvatarBroken(true)} /> : userInitial}
        </div>
        <div className="user-info">
          <p className="user-name">{currentUser.name}</p>
          <p className="user-email">{currentUser.email}</p>
          {isAdmin && <span className="user-role">🔐 ADMIN</span>}
        </div>
      </div>

      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={isMobileViewport ? onMobileClose : onToggleExpand}
        title={toggleLabel}
        aria-label={toggleLabel}
      >
        <span className="nav-icon" aria-hidden="true">
          {isMobileViewport ? 'X' : '<>'}
        </span>
        <span className="nav-text">{toggleLabel}</span>
      </button>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">Features</h3>
          {featureItems.map((item) => {
            const isRestricted = Boolean(item.requiresAdmin && !isAdmin)
            const restrictedLabel = `${item.label} (Admin only)`
            const itemLabel = isRestricted ? restrictedLabel : item.label

            return (
              <button
                key={item.view}
                type="button"
                className={`nav-item ${currentView === item.view ? 'active' : ''} ${isRestricted ? 'restricted' : ''}`}
                onClick={() => handleViewSelect(item.view)}
                title={itemLabel}
                aria-label={itemLabel}
                aria-current={currentView === item.view ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-text">{item.label}</span>
                {isRestricted && <span className="nav-badge">Admin</span>}
              </button>
            )
          })}
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">Import/Export</h3>
          {importExportItems.map((item) => {
            const isRestricted = Boolean(item.requiresAdmin && !isAdmin)
            const restrictedLabel = `${item.label} (Admin only)`
            const itemLabel = isRestricted ? restrictedLabel : item.label

            return (
              <button
                key={item.view}
                type="button"
                className={`nav-item ${currentView === item.view ? 'active' : ''} ${isRestricted ? 'restricted' : ''}`}
                onClick={() => handleViewSelect(item.view)}
                title={itemLabel}
                aria-label={itemLabel}
                aria-current={currentView === item.view ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-text">{item.label}</span>
                {isRestricted && <span className="nav-badge">Admin</span>}
              </button>
            )
          })}
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">Settings</h3>
          {isAdmin && (
            <button type="button" className="nav-item" onClick={handleAdminSelect} title="Admin Settings" aria-label="Admin Settings">
              <span className="nav-icon" aria-hidden="true">
                🔧
              </span>
              <span className="nav-text">Admin Settings</span>
            </button>
          )}
          <button
            type="button"
            className="nav-item"
            onClick={handleSettingsSelect}
            title="Account Settings"
            aria-label="Account Settings"
          >
            <span className="nav-icon" aria-hidden="true">
              ⚙️
            </span>
            <span className="nav-text">Account Settings</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-actions">
        <button type="button" className="logout-btn" onClick={handleLogoutSelect} title="Logout" aria-label="Logout">
          <span className="nav-icon" aria-hidden="true">
            🚪
          </span>
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </aside>
  )
}
