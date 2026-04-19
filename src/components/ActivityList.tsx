import React, { useState } from 'react'
import {
  getActivityTypeBadgeClassName,
  getActivityTypeLabel,
  getActivityTypeShortLabel,
} from '../constants/activityTypes'
import { Activity } from '../supabaseClient'
import { formatDateForDisplay } from '../utils/date'

interface ActivityListProps {
  activities: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
  canDelete?: boolean
  onDeleteDenied?: () => void
}

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onEdit,
  onDelete,
  isLoading = false,
  canDelete = true,
  onDeleteDenied,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      onDeleteDenied?.()
      return
    }

    if (confirm('Are you sure you want to delete this activity?')) {
      await onDelete(id)
    }
  }

  const toggleExpand = (id: string | undefined) => {
    if (!id) return
    setExpandedId(expandedId === id ? null : id)
  }

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <p>No activities recorded yet. Start by adding your first activity!</p>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="activities-table">
        <thead>
          <tr>
            <th className="col-date">Date</th>
            <th className="col-performer">Performer</th>
            <th className="col-type">Type</th>
            <th className="col-system">System</th>
            <th className="col-tag">Tag</th>
            <th className="col-problem">Problem</th>
            <th className="col-action">Action</th>
            <th className="col-actions">Edit/Delete</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const isExpanded = expandedId === activity.id

            return (
              <React.Fragment key={activity.id}>
                <tr
                  className={`activity-row ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => activity.comments && toggleExpand(activity.id)}
                  style={{ cursor: activity.comments ? 'pointer' : 'default' }}
                >
                  <td className="col-date">
                    <span className="date-badge">{formatDateForDisplay(activity.date)}</span>
                  </td>
                  <td className="col-performer">{activity.performer}</td>
                  <td className="col-type">
                    {activity.activityType ? (
                      <span
                        className={`type-badge ${getActivityTypeBadgeClassName(activity.activityType)}`}
                        title={getActivityTypeLabel(activity.activityType)}
                      >
                        {getActivityTypeShortLabel(activity.activityType)}
                      </span>
                    ) : null}
                  </td>
                  <td className="col-system">
                    <span className="system-badge">{activity.system}</span>
                  </td>
                  <td className="col-tag">
                    <span className="tag-badge">{activity.tag}</span>
                  </td>
                  <td className="col-problem">
                    <div className="truncate">{activity.problem}</div>
                  </td>
                  <td className="col-action">
                    <div className="truncate">{activity.action}</div>
                  </td>
                  <td className="col-actions">
                    <div className="activity-action-buttons">
                      <button
                        type="button"
                        className="activity-action-button edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(activity)
                        }}
                        disabled={isLoading}
                        title="Edit activity"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={`activity-action-button ${canDelete ? 'delete' : 'restricted'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (activity.id) {
                            void handleDelete(activity.id)
                          }
                        }}
                        disabled={isLoading}
                        title={
                          canDelete
                            ? 'Delete activity'
                            : 'Only Super Admin users can delete activities'
                        }
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="expanded-row">
                    <td colSpan={8}>
                      <div className="expanded-content">
                        {activity.comments && (
                          <div className="expanded-section">
                            <strong>Comments</strong>
                            <p>{activity.comments}</p>
                          </div>
                        )}
                        {activity.editedBy && (
                          <div className="expanded-section">
                            <strong>Edited by</strong>
                            <p>{activity.editedBy}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
