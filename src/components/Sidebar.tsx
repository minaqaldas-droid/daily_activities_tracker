import React from 'react'
import { User } from '../supabaseClient'

interface SidebarProps {
  currentUser: User
  currentView: 'dashboard' | 'add' | 'search'
  onViewChange: (view: 'dashboard' | 'add' | 'search') => void
  onSettingsClick: () => void
  onAdminClick: () => void
  onLogout: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  onViewChange,
  onSettingsClick,
  onAdminClick,
  onLogout,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="user-avatar">
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <p className="user-name">{currentUser.name}</p>
          <p className="user-email">{currentUser.email}</p>
          {currentUser.role === 'superadmin' && (
            <span className="user-role">🔐 SUPERADMIN</span>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">Features</h3>
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onViewChange('dashboard')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard</span>
          </button>
          <button
            className={`nav-item ${currentView === 'add' ? 'active' : ''}`}
            onClick={() => onViewChange('add')}
          >
            <span className="nav-icon">➕</span>
            <span className="nav-text">Add Activity</span>
          </button>
          <button
            className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
            onClick={() => onViewChange('search')}
          >
            <span className="nav-icon">🔍</span>
            <span className="nav-text">Search</span>
          </button>
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">Settings</h3>
          {currentUser.role === 'superadmin' && (
            <button className="nav-item" onClick={onAdminClick}>
              <span className="nav-icon">🔧</span>
              <span className="nav-text">Admin Settings</span>
            </button>
          )}
          <button className="nav-item" onClick={onSettingsClick}>
            <span className="nav-icon">⚙️</span>
            <span className="nav-text">Account Settings</span>
          </button>
        </div>
      </nav>

      <button className="logout-btn" onClick={onLogout}>
        <span className="nav-icon">🚪</span>
        <span className="nav-text">Logout</span>
      </button>
    </aside>
  )
}
