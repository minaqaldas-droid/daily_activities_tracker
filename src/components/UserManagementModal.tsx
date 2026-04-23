import React, { useEffect, useMemo, useState } from 'react'
import {
  type AdminManagedUser,
  deleteManagedUser,
  getManagedUsers,
  updateManagedUser,
} from '../supabaseClient'

interface UserManagementModalProps {
  onClose: () => void
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<AdminManagedUser[]>([])
  const [draftUsers, setDraftUsers] = useState<AdminManagedUser[]>([])
  const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const data = await getManagedUsers()
      setUsers(data)
      setDraftUsers(data)
      setDeletedUserIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) {
      return draftUsers
    }

    const keyword = search.toLowerCase()
    return draftUsers.filter((item) =>
      [item.id, item.email, item.name, item.role].join(' ').toLowerCase().includes(keyword)
    )
  }, [search, draftUsers])

  const hasPendingChanges = useMemo(() => {
    if (deletedUserIds.size > 0 || users.length !== draftUsers.length) {
      return true
    }

    return draftUsers.some((draftUser) => {
      const original = users.find((item) => item.id === draftUser.id)
      if (!original) {
        return true
      }

      return (
        original.role !== draftUser.role ||
        original.is_approved !== draftUser.is_approved
      )
    })
  }, [deletedUserIds, draftUsers, users])

  const handleRoleChange = (managedUser: AdminManagedUser, role: AdminManagedUser['role']) => {
    setDraftUsers((previous) =>
      previous.map((item) =>
        item.id === managedUser.id
          ? {
              ...item,
              role,
            }
          : item
      )
    )
  }

  const handleDelete = (managedUser: AdminManagedUser) => {
    if (!confirm(`Delete user profile "${managedUser.name}"?`)) {
      return
    }

    setDraftUsers((previous) => previous.filter((item) => item.id !== managedUser.id))
    setDeletedUserIds((previous) => {
      const next = new Set(previous)
      next.add(managedUser.id)
      return next
    })
  }

  const handleApprovalToggle = (managedUser: AdminManagedUser, isApproved: boolean) => {
    setDraftUsers((previous) =>
      previous.map((item) =>
        item.id === managedUser.id
          ? {
              ...item,
              is_approved: isApproved,
              approved_at: isApproved ? new Date().toISOString() : null,
            }
          : item
      )
    )
  }

  const handleSaveSettings = async () => {
    setError('')
    setSuccess('')

    if (!hasPendingChanges) {
      setSuccess('No pending changes to save.')
      return
    }

    try {
      setIsMutating(true)

      for (const draftUser of draftUsers) {
        const original = users.find((item) => item.id === draftUser.id)
        if (!original) {
          continue
        }

        const hasChanges =
          original.role !== draftUser.role ||
          original.is_approved !== draftUser.is_approved

        if (!hasChanges) {
          continue
        }

        await updateManagedUser(draftUser.id, {
          role: draftUser.role,
          isApproved: draftUser.is_approved,
        })
      }

      for (const deletedUserId of deletedUserIds) {
        await deleteManagedUser(deletedUserId)
      }

      await loadUsers()
      setSuccess('Settings saved successfully.')
    } catch (err) {
      const fallbackMessage = 'Failed to save settings.'
      const rawMessage = err instanceof Error ? err.message : fallbackMessage
      const isRoleConstraintError =
        rawMessage.includes('users_role_check') ||
        (rawMessage.includes('role') && rawMessage.includes('violates check constraint'))

      setError(
        isRoleConstraintError
          ? 'Failed to save settings. Database role constraints are outdated. Run MIGRATION_ROLE_MODEL_EDITOR_VIEWER.sql in Supabase SQL Editor.'
          : rawMessage
      )
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="settings-modal user-management-modal">
        <div className="modal-header">
          <h2>User Management</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="form-group user-management-search-group">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            disabled={isLoading || isMutating}
          />
        </div>

        <div className="table-container">
          <table className="activities-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((managedUser) => (
                <tr key={managedUser.id}>
                  <td data-label="ID">
                    <code>{managedUser.id}</code>
                  </td>
                  <td data-label="Email">{managedUser.email}</td>
                  <td data-label="Name">{managedUser.name}</td>
                  <td data-label="Role">
                    <select
                      value={managedUser.role}
                      onChange={(e) =>
                        handleRoleChange(managedUser, e.target.value as AdminManagedUser['role'])
                      }
                      disabled={isMutating}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td data-label="Status">
                    <button
                      type="button"
                      className={`btn ${managedUser.is_approved ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleApprovalToggle(managedUser, !managedUser.is_approved)}
                      disabled={isMutating}
                    >
                      {managedUser.is_approved ? 'Approved' : 'Pending'}
                    </button>
                  </td>
                  <td data-label="Delete">
                    <button type="button" className="btn btn-danger" onClick={() => handleDelete(managedUser)} disabled={isMutating}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-actions user-management-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSaveSettings()}
            disabled={isMutating || !hasPendingChanges}
          >
            Save Settings
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
