import React, { useMemo, useState } from 'react'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { exportActivitiesToExcel } from '../utils/excel'
import { ActivityList } from './ActivityList'
import { getSystemFieldLabel } from '../utils/teamActivityField'

interface ActivityResultsPopupProps {
  isOpen: boolean
  title: string
  description?: string
  activities: Activity[]
  exportFilename?: string
  activeTeam?: Team | null
  settings?: Settings
  onClose: () => void
  onEdit: (activity: Activity) => void
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onEditDenied?: () => void
  onDeleteDenied?: () => void
  onExportSuccess?: (message: string) => void
  onExportError?: (message: string) => void
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function matchesKeyword(activity: Activity, keyword: string) {
  if (!keyword.trim()) {
    return true
  }

  const normalizedKeyword = keyword.toLowerCase()

  return [
    activity.date,
    activity.performer,
    activity.system,
    activity.shift,
    activity.permitNumber,
    activity.instrumentType,
    activity.activityType || '',
    activity.tag,
    activity.problem,
    activity.action,
    activity.comments || '',
  ].some((value) => String(value).toLowerCase().includes(normalizedKeyword))
}

export const ActivityResultsPopup: React.FC<ActivityResultsPopupProps> = ({
  isOpen,
  title,
  description,
  activities,
  exportFilename,
  activeTeam,
  settings,
  onClose,
  onEdit,
  onDelete,
  isLoading = false,
  canEdit = true,
  canDelete = true,
  onEditDenied,
  onDeleteDenied,
  onExportSuccess,
  onExportError,
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20)
  const systemFieldLabel = getSystemFieldLabel(activeTeam)

  const filteredActivities = useMemo(
    () => activities.filter((activity) => matchesKeyword(activity, keyword)),
    [activities, keyword]
  )

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const pagedActivities = filteredActivities.slice(startIndex, startIndex + pageSize)

  if (!isOpen) {
    return null
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const filename = await exportActivitiesToExcel(filteredActivities, {
        filename: exportFilename || `${title.replace(/\s+/g, '_')}.xlsx`,
        systemFieldLabel,
        settings,
      })
      onExportSuccess?.(
        `Exported ${filteredActivities.length} activit${filteredActivities.length === 1 ? 'y' : 'ies'} to ${filename}.`
      )
    } catch (error) {
      onExportError?.(error instanceof Error ? error.message : 'Failed to export activities.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="modal-overlay results-popup-overlay" onClick={onClose}>
      <div
        className="results-popup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-results-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="results-popup-header">
          <div className="results-popup-header-copy">
            <p className="results-popup-kicker">Activity Results</p>
            <h2 id="activity-results-popup-title">{title}</h2>
            {description && <p className="results-popup-description">{description}</p>}
          </div>

          <button type="button" className="modal-close results-popup-close" onClick={onClose} aria-label="Close popup">
            ×
          </button>
        </div>

        <div className="results-popup-toolbar">
          <span className="results-popup-count">
            {filteredActivities.length} activit{filteredActivities.length === 1 ? 'y' : 'ies'}
          </span>

          <div className="results-popup-search-wrap">
            <input
              type="text"
              className="results-popup-search"
              placeholder="Search results..."
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setCurrentPage(1)
              }}
              disabled={isLoading || isExporting}
            />
            {keyword && (
              <button
                type="button"
                className="results-popup-search-clear"
                onClick={() => {
                  setKeyword('')
                  setCurrentPage(1)
                }}
                disabled={isLoading || isExporting}
                aria-label="Clear results search"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <label className="results-popup-page-size">
            Rows
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                setCurrentPage(1)
              }}
              disabled={isLoading || isExporting}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleExport()}
            disabled={isLoading || isExporting || filteredActivities.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        <div className="results-popup-body">
          {isLoading ? (
            <div className="empty-state">
              <p>Loading activities...</p>
            </div>
          ) : (
            <ActivityList
              activities={pagedActivities}
              onEdit={onEdit}
              onDelete={onDelete}
              activeTeam={activeTeam}
              settings={settings}
              isLoading={isLoading || isExporting}
              canEdit={canEdit}
              canDelete={canDelete}
              onEditDenied={onEditDenied}
              onDeleteDenied={onDeleteDenied}
              emptyMessage="No activities found for this view."
            />
          )}

          <div className="results-popup-pagination">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1 || isLoading || isExporting}
            >
              Previous
            </button>
            <span>
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage >= totalPages || isLoading || isExporting}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
