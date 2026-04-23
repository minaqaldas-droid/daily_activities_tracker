import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  getActivityTypeBadgeClassName,
  getActivityTypeLabel,
  getActivityTypeShortLabel,
} from '../constants/activityTypes'
import { type Activity } from '../supabaseClient'
import { formatDateForDisplay } from '../utils/date'

interface ActivityListProps {
  activities: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onEditDenied?: () => void
  onDeleteDenied?: () => void
  emptyMessage?: string
}

type ColumnId =
  | 'date'
  | 'performer'
  | 'type'
  | 'system'
  | 'tag'
  | 'problem'
  | 'action'
  | 'comments'
  | 'actions'

const COLUMN_ORDER: ColumnId[] = [
  'date',
  'performer',
  'type',
  'system',
  'tag',
  'problem',
  'action',
  'comments',
  'actions',
]

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 10,
  performer: 10,
  type: 7,
  system: 9,
  tag: 10,
  problem: 14,
  action: 18,
  comments: 14,
  actions: 8,
}

const MIN_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 7,
  performer: 8,
  type: 6,
  system: 7,
  tag: 8,
  problem: 10,
  action: 12,
  comments: 10,
  actions: 7,
}

const MAX_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 24,
  performer: 24,
  type: 20,
  system: 22,
  tag: 22,
  problem: 30,
  action: 36,
  comments: 30,
  actions: 18,
}

const COLUMN_WIDTHS_STORAGE_KEY = 'activity-table-column-widths'

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onEdit,
  onDelete,
  isLoading = false,
  canEdit = true,
  canDelete = true,
  onEditDenied,
  onDeleteDenied,
  emptyMessage = 'No activities recorded yet. Start by adding your first activity!',
}) => {
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(DEFAULT_COLUMN_WIDTHS)
  const [isResizing, setIsResizing] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as Partial<Record<ColumnId, number>>
      const merged = COLUMN_ORDER.reduce<Record<ColumnId, number>>((acc, key) => {
        const candidate = Number(parsed[key])
        acc[key] = Number.isFinite(candidate) ? candidate : DEFAULT_COLUMN_WIDTHS[key]
        return acc
      }, { ...DEFAULT_COLUMN_WIDTHS })

      setColumnWidths(merged)
    } catch (error) {
      console.warn('Failed to restore saved table column widths:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  const normalizedColumnWidths = useMemo(() => {
    const total = COLUMN_ORDER.reduce((sum, key) => sum + columnWidths[key], 0)
    if (total <= 0) {
      return DEFAULT_COLUMN_WIDTHS
    }

    return COLUMN_ORDER.reduce<Record<ColumnId, number>>((acc, key) => {
      acc[key] = (columnWidths[key] / total) * 100
      return acc
    }, { ...DEFAULT_COLUMN_WIDTHS })
  }, [columnWidths])

  const handleColumnResizeStart = (columnId: ColumnId, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const containerWidth = tableContainerRef.current?.clientWidth || 0
    if (containerWidth <= 0) {
      return
    }

    const startX = event.clientX
    const startWidths = { ...columnWidths }
    const currentIndex = COLUMN_ORDER.indexOf(columnId)
    const adjacentIndex = currentIndex < COLUMN_ORDER.length - 1 ? currentIndex + 1 : currentIndex - 1
    if (adjacentIndex < 0) {
      return
    }

    const adjacentColumn = COLUMN_ORDER[adjacentIndex]
    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX
      const deltaPercent = (deltaPx / containerWidth) * 100

      let nextCurrent = startWidths[columnId] + deltaPercent
      nextCurrent = Math.max(MIN_COLUMN_WIDTHS[columnId], Math.min(MAX_COLUMN_WIDTHS[columnId], nextCurrent))

      const appliedDelta = nextCurrent - startWidths[columnId]

      let nextAdjacent = startWidths[adjacentColumn] - appliedDelta
      nextAdjacent = Math.max(
        MIN_COLUMN_WIDTHS[adjacentColumn],
        Math.min(MAX_COLUMN_WIDTHS[adjacentColumn], nextAdjacent)
      )

      const constrainedDelta = startWidths[adjacentColumn] - nextAdjacent
      const finalCurrent = startWidths[columnId] + constrainedDelta

      setColumnWidths((previous) => ({
        ...previous,
        [columnId]: finalCurrent,
        [adjacentColumn]: nextAdjacent,
      }))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      onDeleteDenied?.()
      return
    }

    if (confirm('Are you sure you want to delete this activity?')) {
      await onDelete(id)
    }
  }

  const handleEdit = (activity: Activity) => {
    if (!canEdit) {
      onEditDenied?.()
      return
    }

    onEdit(activity)
  }

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div ref={tableContainerRef} className="table-container">
      <table className={`activities-table ${isResizing ? 'resizing-columns' : ''}`}>
        <colgroup>
          {COLUMN_ORDER.map((columnId) => (
            <col key={`col-${columnId}`} style={{ width: `${normalizedColumnWidths[columnId]}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="col-date resizable-th">
              Date
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('date', event)} />
            </th>
            <th className="col-performer resizable-th">
              Performer
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('performer', event)} />
            </th>
            <th className="col-type resizable-th">
              Type
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('type', event)} />
            </th>
            <th className="col-system resizable-th">
              System
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('system', event)} />
            </th>
            <th className="col-tag resizable-th">
              Tag
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('tag', event)} />
            </th>
            <th className="col-problem resizable-th">
              Problem
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('problem', event)} />
            </th>
            <th className="col-action resizable-th">
              Action
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('action', event)} />
            </th>
            <th className="col-comments resizable-th">
              Comments
              <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart('comments', event)} />
            </th>
            <th className="col-actions resizable-th">
              Edit/Delete
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity.id} className="activity-row">
                  <td className="col-date" data-label="Date">
                    <span className="date-badge">{formatDateForDisplay(activity.date)}</span>
                  </td>
                  <td className="col-performer" data-label="Performer">
                    {activity.performer}
                  </td>
                  <td className="col-type" data-label="Type">
                    {activity.activityType ? (
                      <span
                        className={`type-badge ${getActivityTypeBadgeClassName(activity.activityType)}`}
                        title={getActivityTypeLabel(activity.activityType)}
                      >
                        {getActivityTypeShortLabel(activity.activityType)}
                      </span>
                    ) : null}
                  </td>
                  <td className="col-system" data-label="System">
                    <span className="system-badge">{activity.system}</span>
                  </td>
                  <td className="col-tag" data-label="Tag">
                    <span className="tag-badge">{activity.tag}</span>
                  </td>
                  <td className="col-problem" data-label="Problem">
                    <div className="truncate">{activity.problem}</div>
                  </td>
                  <td className="col-action" data-label="Action">
                    <div className="truncate">{activity.action}</div>
                  </td>
                  <td className="col-comments" data-label="Comments">
                    <div className="truncate">{activity.comments || '-'}</div>
                  </td>
                  <td className="col-actions" data-label="Edit / Delete">
                    <div className="activity-action-buttons">
                      <button
                        type="button"
                        className={`activity-action-button ${canEdit ? 'edit' : 'restricted'}`}
                        onClick={() => {
                          handleEdit(activity)
                        }}
                        disabled={isLoading}
                        title={canEdit ? 'Edit activity' : 'Only Admin users can edit activities'}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={`activity-action-button ${canDelete ? 'delete' : 'restricted'}`}
                        onClick={() => {
                          if (activity.id) {
                            void handleDelete(activity.id)
                          }
                        }}
                        disabled={isLoading}
                        title={canDelete ? 'Delete activity' : 'Only Admin users can delete activities'}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
