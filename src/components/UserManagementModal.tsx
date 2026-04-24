import React, { useEffect, useMemo, useState } from 'react'
import {
  type ManagedTeam,
  type Team,
  type TeamManagedUser,
  type User,
  type UserRole,
  createManagedTeam,
  deleteManagedUser,
  deleteManagedTeam,
  getManagedUsers,
  getManagedTeams,
  getTeamManagedUsers,
  setUserTeamMembership,
  updateManagedTeam,
  updateManagedUser,
} from '../supabaseClient'

interface UserManagementModalProps {
  currentUser: User
  activeTeam?: Team | null
  onClose: () => void
  onTeamsChanged?: (deletedTeamId?: string) => void
}

type ManagedUserDraft = TeamManagedUser
const ROLE_OPTIONS: UserRole[] = ['admin', 'editor', 'viewer']

function getSortedIds(ids: string[]) {
  return [...ids].sort()
}

function getTeamRole(user: ManagedUserDraft, team: Pick<ManagedTeam, 'id' | 'uses_legacy_tables'>): UserRole {
  return user.team_roles[team.id] || (team.uses_legacy_tables ? user.role : 'viewer')
}

function haveSameTeamAssignments(first: ManagedUserDraft, second: ManagedUserDraft, teams: ManagedTeam[]) {
  const firstTeamIds = getSortedIds(first.team_ids)
  const secondTeamIds = getSortedIds(second.team_ids)
  const teamIdsMatch =
    firstTeamIds.length === secondTeamIds.length &&
    firstTeamIds.every((teamId, index) => teamId === secondTeamIds[index])

  if (!teamIdsMatch) {
    return false
  }

  return teams.every((team) => {
    const firstIsMember = team.uses_legacy_tables || first.team_ids.includes(team.id)
    const secondIsMember = team.uses_legacy_tables || second.team_ids.includes(team.id)

    if (!firstIsMember && !secondIsMember) {
      return true
    }

    return getTeamRole(first, team) === getTeamRole(second, team)
  })
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ currentUser, activeTeam, onClose, onTeamsChanged }) => {
  const [users, setUsers] = useState<ManagedUserDraft[]>([])
  const [draftUsers, setDraftUsers] = useState<ManagedUserDraft[]>([])
  const [teams, setTeams] = useState<ManagedTeam[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [teamNameDrafts, setTeamNameDrafts] = useState<Record<string, string>>({})
  const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isSuperadmin = currentUser.is_superadmin === true

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const [teamData, userData] = await Promise.all([
        isSuperadmin ? getManagedTeams() : Promise.resolve([]),
        isSuperadmin ? getTeamManagedUsers() : getManagedUsers(),
      ])
      const normalizedUsers: ManagedUserDraft[] = userData.map((user) => {
        const teamIds =
          'team_ids' in user && Array.isArray(user.team_ids)
            ? user.team_ids
            : activeTeam?.id
              ? [activeTeam.id]
              : []
        const teamRoles: Record<string, UserRole> =
          'team_roles' in user && user.team_roles
            ? (user.team_roles as Record<string, UserRole>)
            : activeTeam?.id
              ? { [activeTeam.id]: user.role }
              : ({} as Record<string, UserRole>)

        return {
          ...user,
          team_ids: teamIds,
          team_roles: teamRoles,
        }
      })
      setTeams(teamData)
      setTeamNameDrafts(
        teamData.reduce<Record<string, string>>((drafts, team) => {
          drafts[team.id] = team.name
          return drafts
        }, {})
      )
      setUsers(normalizedUsers)
      setDraftUsers(normalizedUsers)
      setDeletedUserIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [activeTeam?.id, isSuperadmin])

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
        original.is_approved !== draftUser.is_approved ||
        !haveSameTeamAssignments(original, draftUser, teams)
      )
    })
  }, [deletedUserIds, draftUsers, teams, users])

  const handleRoleChange = (managedUser: ManagedUserDraft, role: UserRole) => {
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

  const handleTeamRoleChange = (managedUser: ManagedUserDraft, teamId: string, role: UserRole) => {
    setDraftUsers((previous) =>
      previous.map((item) =>
        item.id === managedUser.id
          ? {
              ...item,
              team_roles: {
                ...item.team_roles,
                [teamId]: role,
              },
            }
          : item
      )
    )
  }

  const handleDelete = (managedUser: ManagedUserDraft) => {
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

  const handleApprovalToggle = (managedUser: ManagedUserDraft, isApproved: boolean) => {
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

  const handleTeamToggle = (managedUser: ManagedUserDraft, teamId: string, enabled: boolean) => {
    setDraftUsers((previous) =>
      previous.map((item) => {
        if (item.id !== managedUser.id) {
          return item
        }

        const nextTeamIds = enabled
          ? Array.from(new Set([...item.team_ids, teamId]))
          : item.team_ids.filter((id) => id !== teamId)
        const nextTeamRoles = { ...item.team_roles }

        if (enabled && !nextTeamRoles[teamId]) {
          nextTeamRoles[teamId] = item.role || 'viewer'
        }

        if (!enabled) {
          delete nextTeamRoles[teamId]
        }

        return {
          ...item,
          team_ids: nextTeamIds,
          team_roles: nextTeamRoles,
        }
      })
    )
  }

  const handleCreateTeam = async () => {
    setError('')
    setSuccess('')

    if (!newTeamName.trim()) {
      setError('Team name is required.')
      return
    }

    try {
      setIsMutating(true)
      await createManagedTeam({ name: newTeamName })
      setNewTeamName('')
      await loadUsers()
      onTeamsChanged?.()
      setSuccess('Team created successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team.')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteTeam = async (team: ManagedTeam) => {
    if (team.slug === 'automation') {
      setError('Automation is the primary migrated team and cannot be deleted.')
      return
    }

    const confirmed = confirm(
      `Delete team "${team.name}"? This will delete its team activities, settings, and memberships from the unified team tables.`
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsMutating(true)
      await deleteManagedTeam(team.id)
      await loadUsers()
      onTeamsChanged?.(team.id)
      setSuccess(`Team "${team.name}" deleted successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team.')
    } finally {
      setIsMutating(false)
    }
  }

  const handleRenameTeam = async (team: ManagedTeam) => {
    const nextName = (teamNameDrafts[team.id] || '').trim()

    if (!nextName) {
      setError('Team name is required.')
      return
    }

    if (nextName === team.name) {
      setSuccess('No team name changes to save.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsMutating(true)
      await updateManagedTeam(team.id, { name: nextName })
      await loadUsers()
      onTeamsChanged?.()
      setSuccess(`Team "${team.name}" renamed to "${nextName}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename team.')
    } finally {
      setIsMutating(false)
    }
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

        const legacyTeam = teams.find((team) => team.uses_legacy_tables)
        const legacyRoleChanged = Boolean(
          legacyTeam && getTeamRole(original, legacyTeam) !== getTeamRole(draftUser, legacyTeam)
        )
        const hasProfileChanges =
          original.role !== draftUser.role ||
          original.is_approved !== draftUser.is_approved ||
          legacyRoleChanged

        if (hasProfileChanges) {
          await updateManagedUser(draftUser.id, {
            role: legacyTeam ? getTeamRole(draftUser, legacyTeam) : draftUser.role,
            isApproved:
              original.is_approved !== draftUser.is_approved ? draftUser.is_approved : undefined,
          })
        }
      }

      if (isSuperadmin) {
        for (const draftUser of draftUsers) {
          const original = users.find((item) => item.id === draftUser.id)
          if (!original) {
            continue
          }

          for (const team of teams) {
            const wasMember = team.uses_legacy_tables || original.team_ids.includes(team.id)
            const isMember = team.uses_legacy_tables || draftUser.team_ids.includes(team.id)
            const originalRole = getTeamRole(original, team)
            const draftRole = getTeamRole(draftUser, team)
            const membershipChanged = !team.uses_legacy_tables && wasMember !== isMember
            const roleChanged = isMember && originalRole !== draftRole

            if (!membershipChanged && !roleChanged) {
              continue
            }

            await setUserTeamMembership({
              userId: draftUser.id,
              teamId: team.id,
              enabled: isMember,
              role: draftRole,
            })
          }
        }
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
          ? 'Failed to save settings. Database role constraints are outdated. Run migration/MIGRATION_ROLE_MODEL_EDITOR_VIEWER.sql in Supabase SQL Editor.'
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
          <h2>Super Admin User Management</h2>
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

        {isSuperadmin && (
          <div className="team-management-panel">
            <div className="team-management-header">
              <div>
                <h3>Teams</h3>
              </div>
              <div className="team-create-controls">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  placeholder="Process, Instrumentation..."
                  disabled={isMutating}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleCreateTeam()}
                  disabled={isMutating}
                >
                  Create Team
                </button>
              </div>
            </div>
            <div className="team-chip-list">
              {teams.map((team) => (
                <div key={team.id} className="team-chip">
                  <input
                    type="text"
                    value={teamNameDrafts[team.id] ?? team.name}
                    onChange={(event) =>
                      setTeamNameDrafts((previous) => ({
                        ...previous,
                        [team.id]: event.target.value,
                      }))
                    }
                    disabled={isMutating}
                    aria-label={`Team name for ${team.name}`}
                  />
                  <small>{`${team.member_count} users`}</small>
                  <button
                    type="button"
                    className="team-chip-save"
                    onClick={() => void handleRenameTeam(team)}
                    disabled={isMutating || (teamNameDrafts[team.id] ?? team.name).trim() === team.name}
                    title={`Save ${team.name} name`}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="team-chip-delete"
                    onClick={() => void handleDeleteTeam(team)}
                    disabled={team.slug === 'automation' || isMutating}
                    title={team.slug === 'automation' ? 'Automation cannot be deleted' : `Delete ${team.name}`}
                    aria-label={`Delete ${team.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="activities-table user-management-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Name</th>
                {!isSuperadmin && <th>Role</th>}
                {isSuperadmin && <th>Team Roles</th>}
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
                  {!isSuperadmin && (
                    <td data-label="Role">
                      <select
                        value={managedUser.role}
                        onChange={(e) => handleRoleChange(managedUser, e.target.value as UserRole)}
                        disabled={isMutating}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {isSuperadmin && (
                    <td data-label="Team Roles">
                      <div className="team-role-grid">
                        {teams.map((team) => {
                          const isAssigned = team.uses_legacy_tables || managedUser.team_ids.includes(team.id)

                          return (
                            <div key={team.id} className={`team-role-row ${isAssigned ? 'assigned' : ''}`}>
                              <label className="team-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  disabled={team.uses_legacy_tables || isMutating}
                                  onChange={(event) =>
                                    handleTeamToggle(managedUser, team.id, event.target.checked)
                                  }
                                />
                                <span>{team.name}</span>
                              </label>
                              <select
                                value={getTeamRole(managedUser, team)}
                                onChange={(event) =>
                                  handleTeamRoleChange(managedUser, team.id, event.target.value as UserRole)
                                }
                                disabled={!isAssigned || isMutating}
                                aria-label={`${team.name} role for ${managedUser.name}`}
                              >
                                {ROLE_OPTIONS.map((role) => (
                                  <option key={role} value={role}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )}
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
