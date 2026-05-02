import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  getActivityTypeBadgeClassName,
  getActivityTypeLabel,
  getActivityTypeShortLabel,
} from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { type ActivityFieldDefinition, getActivityFieldLabel, getActivityFieldValue, getEnabledActivityFields } from '../utils/activityFields'
import { formatDateForDisplay } from '../utils/date'

interface ActivityListProps {
  activities: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (id: string) => Promise<void>
  activeTeam?: Team | null
  settings?: Settings
  isLoading?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onEditDenied?: () => void
  onDeleteDenied?: () => void
  emptyMessage?: string
}

const DEFAULT_COLUMN_WIDTH = 12
const MIN_COLUMN_WIDTH = 7
const MAX_COLUMN_WIDTH = 36
const COLUMN_WIDTHS_STORAGE_KEY = 'activity-table-column-widths'

function renderCellContent(activity: Activity, field: ActivityFieldDefinition) {
  const value = getActivityFieldValue(activity, field.key)

  switch (field.key) {
    case 'date':
      return <span className="date-badge">{formatDateForDisplay(activity.date)}</span>
    case 'activityType':
      return activity.activityType ? (
        <span
          className={`type-badge ${getActivityTypeBadgeClassName(activity.activityType)}`}
          title={getActivityTypeLabel(activity.activityType)}
        >
          {getActivityTypeShortLabel(activity.activityType)}
        </span>
      ) : null
    case 'system':
    case 'shift':
    case 'permitNumber':
    case 'instrumentType':
    case 'tag':
      return <span className={field.key === 'tag' ? 'tag-badge' : 'system-badge'}>{value || '-'}</span>
    case 'problem':
    case 'action':
    case 'comments':
      return field.tableBadge ? <span className="system-badge">{value || '-'}</span> : <div className="truncate">{value || '-'}</div>
    default:
      return field.tableBadge ? <span className="system-badge">{value || '-'}</span> : value || '-'
  }
}

export const ActivityList: React.FC<ActivityListProps> = ({
  activities,
  onEdit,
  onDelete,
  settings,
  isLoading = false,
  canEdit = true,
  canDelete = true,
  onEditDenied,
  onDeleteDenied,
  emptyMessage = 'No activities recorded yet. Start by adding your first activity!',
}) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [isResizing, setIsResizing] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const visibleFieldDefinitions = getEnabledActivityFields(settings).filter((field) => field.type !== 'checkbox')
  const visibleFieldColumns = visibleFieldDefinitions.map((field) => field.key)
  const visibleFieldsByKey = useMemo(
    () => new Map(visibleFieldDefinitions.map((field) => [field.key, field])),
    [visibleFieldDefinitions]
  )
  const visibleColumns = useMemo(() => [...visibleFieldColumns, 'actions'], [visibleFieldColumns])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as Record<string, number>
      setColumnWidths(parsed)
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
    const total = visibleColumns.reduce((sum, key) => sum + (columnWidths[key] || DEFAULT_COLUMN_WIDTH), 0)
    if (total <= 0) {
      return Object.fromEntries(visibleColumns.map((key) => [key, DEFAULT_COLUMN_WIDTH]))
    }

    return Object.fromEntries(
      visibleColumns.map((key) => [key, (((columnWidths[key] || DEFAULT_COLUMN_WIDTH) / total) * 100)])
    )
  }, [columnWidths, visibleColumns])

  const handleColumnResizeStart = (columnId: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const containerWidth = tableContainerRef.current?.clientWidth || 0
    if (containerWidth <= 0) {
      return
    }

    const startX = event.clientX
    const startWidths = Object.fromEntries(visibleColumns.map((key) => [key, columnWidths[key] || DEFAULT_COLUMN_WIDTH]))
    const currentIndex = visibleColumns.indexOf(columnId)
    const adjacentIndex = currentIndex < visibleColumns.length - 1 ? currentIndex + 1 : currentIndex - 1
    if (adjacentIndex < 0) {
      return
    }

    const adjacentColumn = visibleColumns[adjacentIndex]
    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX
      const deltaPercent = (deltaPx / containerWidth) * 100

      let nextCurrent = startWidths[columnId] + deltaPercent
      nextCurrent = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, nextCurrent))

      const appliedDelta = nextCurrent - startWidths[columnId]
      let nextAdjacent = startWidths[adjacentColumn] - appliedDelta
      nextAdjacent = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, nextAdjacent))

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
          {visibleColumns.map((columnId) => (
            <col key={`col-${columnId}`} style={{ width: `${normalizedColumnWidths[columnId]}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleFieldColumns.map((columnId) => (
              <th key={columnId} className="resizable-th">
                {getActivityFieldLabel(columnId, settings)}
                <span className="column-resize-handle" onMouseDown={(event) => handleColumnResizeStart(columnId, event)} />
              </th>
            ))}
            <th className="col-actions resizable-th">Edit/Delete</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity.id} className="activity-row">
              {visibleFieldColumns.map((columnId) => (
                <td key={columnId} data-label={getActivityFieldLabel(columnId, settings)}>
                  {renderCellContent(activity, visibleFieldsByKey.get(columnId) || {
                    key: columnId,
                    label: getActivityFieldLabel(columnId, settings),
                    placeholder: '',
                    type: 'text',
                    defaultEnabled: true,
                    defaultRequired: false,
                    defaultOrder: 0,
                  })}
                </td>
              ))}
              <td className="col-actions" data-label="Edit / Delete">
                <div className="activity-action-buttons">
                  <button
                    type="button"
                    className={`activity-action-button ${canEdit ? 'edit' : 'restricted'}`}
                    onClick={() => handleEdit(activity)}
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
