import React, { useState } from 'react'
import { Activity } from '../supabaseClient'

interface ActivityListProps {
  activities: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
}

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
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
            <th className="col-system">System</th>
            <th className="col-instrument">Instrument/Tag</th>
            <th className="col-problem">Problem</th>
            <th className="col-action">Action</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <React.Fragment key={activity.id}>
              <tr
                className={`activity-row ${expandedId === activity.id ? 'expanded' : ''}`}
                onClick={() => activity.comments && toggleExpand(activity.id)}
                style={{ cursor: activity.comments ? 'pointer' : 'default' }}
              >
                <td className="col-date">
                  <span className="date-badge">{activity.date}</span>
                </td>
                <td className="col-performer">{activity.performer}</td>
                <td className="col-system">
                  <span className="system-badge">{activity.system}</span>
                </td>
                <td className="col-instrument">
                  <span className="instrument-tag">{activity.instrument}</span>
                </td>
                <td className="col-problem">
                  <div className="truncate">{activity.problem}</div>
                </td>
                <td className="col-action">
                  <div className="truncate">{activity.action}</div>
                </td>
                <td className="col-actions">
                  <button
                    className="btn btn-edit btn-sm"
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
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(activity.id!)
                    }}
                    disabled={isLoading}
                    title="Delete activity"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
              {expandedId === activity.id && (
                <tr className="expanded-row">
                  <td colSpan={7}>
                    <div className="expanded-content">
                      {activity.comments && (
                        <div className="expanded-section">
                          <strong>📝 Comments:</strong>
                          <p>{activity.comments}</p>
                        </div>
                      )}
                      {activity.editedBy && (
                        <div className="expanded-section">
                          <strong>✏️ Edited by:</strong> {activity.editedBy}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
