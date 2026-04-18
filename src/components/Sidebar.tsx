import React, { useEffect, useState } from 'react'
import { User } from '../supabaseClient'

interface SidebarProps {
  currentUser: User
  currentView: 'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export'
  onViewChange: (view: 'dashboard' | 'add' | 'edit' | 'search' | 'import' | 'export') => void
  isExpanded: boolean
  onToggleExpand: () => void
  onSettingsClick: () => void
  onAdminClick: () => void
  onLogout: () => void
}

type NavView = SidebarProps['currentView']

const featureItems: Array<{ icon: string; label: string; view: NavView }> = [
  { icon: '📊', label: 'Dashboard', view: 'dashboard' },
  { icon: '➕', label: 'Add Activity', view: 'add' },
  { icon: '📝', label: 'Edit Activity', view: 'edit' },
  { icon: '🔍', label: 'Search', view: 'search' },
]

const importExportItems: Array<{ icon: string; label: string; view: NavView }> = [
  { icon: '📥', label: 'Import Excel', view: 'import' },
  { icon: '📤', label: 'Export Excel', view: 'export' },
]

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  onViewChange,
  isExpanded,
  onToggleExpand,
  onSettingsClick,
  onAdminClick,
  onLogout,
}) => {
  const [isAvatarBroken, setIsAvatarBroken] = useState(false)

  useEffect(() => {
    setIsAvatarBroken(false)
  }, [currentUser.avatar_url])

  const showAvatarImage = Boolean(currentUser.avatar_url && !isAvatarBroken)
  const userInitial = currentUser.name.trim().charAt(0).toUpperCase() || 'U'
  const toggleLabel = isExpanded ? 'Collapse sidebar' : 'Expand sidebar'

  return (
    <aside className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`} aria-label="Primary navigation">
      <div
        className="sidebar-header"
        title={`${currentUser.name} (${currentUser.email})${currentUser.role === 'superadmin' ? ' - Superadmin' : ''}`}
      >
        <div className={`user-avatar ${showAvatarImage ? 'has-image' : ''}`} aria-hidden="true">
          {showAvatarImage ? (
            <img src={currentUser.avatar_url} alt="" onError={() => setIsAvatarBroken(true)} />
          ) : (
            userInitial
          )}
        </div>
        <div className="user-info">
          <p className="user-name">{currentUser.name}</p>
          <p className="user-email">{currentUser.email}</p>
          {currentUser.role === 'superadmin' && <span className="user-role">🔐 SUPERADMIN</span>}
        </div>
      </div>

      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={onToggleExpand}
        title={toggleLabel}
        aria-label={toggleLabel}
      >
        <span className="nav-icon" aria-hidden="true">
          ⇆
        </span>
        <span className="nav-text">{toggleLabel}</span>
      </button>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">Features</h3>
          {featureItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`nav-item ${currentView === item.view ? 'active' : ''}`}
              onClick={() => onViewChange(item.view)}
              title={item.label}
              aria-label={item.label}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">Import/Export</h3>
          {importExportItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`nav-item ${currentView === item.view ? 'active' : ''} ${
                item.view === 'import' && currentUser.role !== 'superadmin' ? 'restricted' : ''
              }`}
              onClick={() => onViewChange(item.view)}
              title={
                item.view === 'import' && currentUser.role !== 'superadmin'
                  ? `${item.label} (Super Admin only)`
                  : item.label
              }
              aria-label={
                item.view === 'import' && currentUser.role !== 'superadmin'
                  ? `${item.label} (Super Admin only)`
                  : item.label
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-text">{item.label}</span>
              {item.view === 'import' && currentUser.role !== 'superadmin' && (
                <span className="nav-badge">Admin</span>
              )}
            </button>
          ))}
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">Settings</h3>
          {currentUser.role === 'superadmin' && (
            <button
              type="button"
              className="nav-item"
              onClick={onAdminClick}
              title="Admin Settings"
              aria-label="Admin Settings"
            >
              <span className="nav-icon" aria-hidden="true">
                🔧
              </span>
              <span className="nav-text">Admin Settings</span>
            </button>
          )}
          <button
            type="button"
            className="nav-item"
            onClick={onSettingsClick}
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
        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
        >
          <span className="nav-icon" aria-hidden="true">
            🚪
          </span>
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </aside>
  )
}
