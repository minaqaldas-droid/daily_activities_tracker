import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  getActivityTypeBadgeClassName,
  getActivityTypeLabel,
  getActivityTypeShortLabel,
} from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { type ConfigurableActivityFieldKey, getEnabledActivityFields, getActivityFieldValue } from '../utils/activityFields'
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

type ColumnId = ConfigurableActivityFieldKey | 'actions'

const ALL_COLUMNS: ColumnId[] = [
  'date',
  'performer',
  'system',
  'shift',
  'permitNumber',
  'instrumentType',
  'activityType',
  'tag',
  'problem',
  'action',
  'comments',
  'actions',
]

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 10,
  performer: 10,
  system: 9,
  shift: 8,
  permitNumber: 10,
  instrumentType: 10,
  activityType: 8,
  tag: 10,
  problem: 14,
  action: 18,
  comments: 14,
  actions: 8,
}

const MIN_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 7,
  performer: 8,
  system: 7,
  shift: 7,
  permitNumber: 8,
  instrumentType: 8,
  activityType: 7,
  tag: 8,
  problem: 10,
  action: 12,
  comments: 10,
  actions: 7,
}

const MAX_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: 24,
  performer: 24,
  system: 22,
  shift: 18,
  permitNumber: 24,
  instrumentType: 24,
  activityType: 18,
  tag: 22,
  problem: 30,
  action: 36,
  comments: 30,
  actions: 18,
}

const COLUMN_WIDTHS_STORAGE_KEY = 'activity-table-column-widths'

function getColumnLabel(columnId: ConfigurableActivityFieldKey) {
  switch (columnId) {
    case 'activityType':
      return 'Activity Type'
    case 'permitNumber':
      return 'Permit Number'
    case 'instrumentType':
      return 'Instrument Type'
    case 'action':
      return 'Action'
    case 'comments':
      return 'Comments'
    case 'performer':
      return 'Performer'
    case 'problem':
      return 'Problem'
    case 'tag':
      return 'Tag'
    case 'date':
      return 'Date'
    case 'shift':
      return 'Shift'
    case 'system':
      return 'System'
    default:
      return columnId
  }
}

function renderCellContent(activity: Activity, columnId: ConfigurableActivityFieldKey) {
  switch (columnId) {
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
      return <span className={columnId === 'tag' ? 'tag-badge' : 'system-badge'}>{getActivityFieldValue(activity, columnId) || '-'}</span>
    case 'problem':
    case 'action':
    case 'comments':
      return <div className="truncate">{getActivityFieldValue(activity, columnId) || '-'}</div>
    default:
      return getActivityFieldValue(activity, columnId) || '-'
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
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(DEFAULT_COLUMN_WIDTHS)
  const [isResizing, setIsResizing] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const visibleFieldColumns = getEnabledActivityFields(settings).map((field) => field.key)
  const visibleColumns = useMemo<ColumnId[]>(() => [...visibleFieldColumns, 'actions'], [visibleFieldColumns])

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
      const merged = ALL_COLUMNS.reduce<Record<ColumnId, number>>((acc, key) => {
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
    const total = visibleColumns.reduce((sum, key) => sum + columnWidths[key], 0)
    if (total <= 0) {
      return DEFAULT_COLUMN_WIDTHS
    }

    return visibleColumns.reduce<Record<ColumnId, number>>((acc, key) => {
      acc[key] = (columnWidths[key] / total) * 100
      return acc
    }, { ...DEFAULT_COLUMN_WIDTHS })
  }, [columnWidths, visibleColumns])

  const handleColumnResizeStart = (columnId: ColumnId, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const containerWidth = tableContainerRef.current?.clientWidth || 0
    if (containerWidth <= 0) {
      return
    }

    const startX = event.clientX
    const startWidths = { ...columnWidths }
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
          {visibleColumns.map((columnId) => (
            <col key={`col-${columnId}`} style={{ width: `${normalizedColumnWidths[columnId]}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleFieldColumns.map((columnId) => (
              <th key={columnId} className="resizable-th">
                {getColumnLabel(columnId)}
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
                <td key={columnId} data-label={getColumnLabel(columnId)}>
                  {renderCellContent(activity, columnId)}
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
