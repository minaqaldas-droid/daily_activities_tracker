import React, { useState } from 'react'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { exportActivitiesToExcel } from '../utils/excel'
import { getSystemFieldLabel } from '../utils/teamActivityField'

interface ExcelExportProps {
  activities: Activity[]
  activeTeam?: Team | null
  settings?: Settings
  isLoading?: boolean
}

function isActivityWithinDateRange(activity: Activity, startDate: string, endDate: string) {
  if (!activity.date) {
    return false
  }

  const activityDate = new Date(activity.date)
  const start = new Date(startDate)
  const end = new Date(endDate)
  return activityDate >= start && activityDate <= end
}

export const ExcelExport: React.FC<ExcelExportProps> = ({
  activities,
  activeTeam,
  settings,
  isLoading = false,
}) => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const [exportFormat, setExportFormat] = useState<'current' | 'dateRange'>('dateRange')
  const [isPreparing, setIsPreparing] = useState(false)
  const systemFieldLabel = getSystemFieldLabel(activeTeam)

  const dateRangeActivities = activities.filter((activity) =>
    isActivityWithinDateRange(activity, dateRange.startDate, dateRange.endDate)
  )

  const handleExport = async () => {
    const dataToExport = exportFormat === 'current' ? activities : dateRangeActivities

    if (dataToExport.length === 0) {
      alert('No activities found for the selected date range')
      return
    }

    try {
      setIsPreparing(true)
      await exportActivitiesToExcel(dataToExport, {
        filename:
          exportFormat === 'dateRange'
            ? `Activities_${dateRange.startDate}_to_${dateRange.endDate}.xlsx`
            : `Activities_${new Date().toISOString().split('T')[0]}.xlsx`,
        systemFieldLabel,
        settings,
      })
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <div className="excel-export-container">
      <div className="excel-export-section">
        <h3>Export Activities to Excel</h3>

        <div className="export-options">
          <div className="export-option">
            <label>
              <input
                type="radio"
                name="export-format"
                value="current"
                checked={exportFormat === 'current'}
                onChange={() => setExportFormat('current')}
              />
              Export All Activities ({activities.length} total)
            </label>
          </div>

          <div className="export-option">
            <label>
              <input
                type="radio"
                name="export-format"
                value="dateRange"
                checked={exportFormat === 'dateRange'}
                onChange={() => setExportFormat('dateRange')}
              />
              Export Activities in Date Range
            </label>

            {exportFormat === 'dateRange' && (
              <div className="date-range-inputs">
                <div className="date-input-group">
                  <label htmlFor="start-date">Start Date:</label>
                  <input
                    id="start-date"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="date-input-group">
                  <label htmlFor="end-date">End Date:</label>
                  <input
                    id="end-date"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                  />
                </div>

                <p className="date-range-info">{dateRangeActivities.length} activities in range</p>
              </div>
            )}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={isLoading || isPreparing || activities.length === 0}
        >
          {isLoading || isPreparing ? 'Preparing...' : 'Download Excel File'}
        </button>
      </div>
    </div>
  )
}
