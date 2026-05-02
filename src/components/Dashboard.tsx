import React, { useEffect, useMemo, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { type DashboardResultsFilter } from '../types/activityResults'
import { type DashboardChartKey, getEnabledDashboardCharts } from '../utils/dashboardCharts'
import { getSystemFieldLabel } from '../utils/teamActivityField'
import { ActivityList } from './ActivityList'

export interface DashboardActivityRequest {
  title: string
  description: string
  activities?: Activity[]
  exportFilename?: string
  filter?: DashboardResultsFilter
}

interface DashboardProps {
  activities: Activity[]
  recentActivities?: Activity[]
  performerName: string
  onEdit?: (activity: Activity) => void
  onDelete?: (id: string) => Promise<void>
  isLoading?: boolean
  canEdit?: boolean
  canDelete?: boolean
  activeTeam?: Team | null
  settings?: Settings
  onEditDenied?: () => void
  onDeleteDenied?: () => void
  onOpenActivityResults?: (request: DashboardActivityRequest) => void
}

interface DashboardStats {
  totalActivities: number
  myActivities: number
  activityByPerformer: Map<string, number>
  activityByTag: Map<string, number>
  activityBySystem: Map<string, number>
  activityByShift: Map<string, number>
  activityByInstrumentType: Map<string, number>
  activityByType: Map<string, number>
  recentActivities: Activity[]
  recentlyEditedActivities: Activity[]
  thisWeekActivities: number
}

interface ChartDatum {
  key: string
  label: string
  value: number
}

const CHART_COLORS = [
  'var(--chart-color-1)',
  'var(--chart-color-2)',
  'var(--chart-color-3)',
  'var(--chart-color-4)',
  'var(--chart-color-5)',
  'var(--chart-color-6)',
  'var(--chart-color-7)',
  'var(--chart-color-8)',
  'var(--chart-color-9)',
  'var(--chart-color-10)',
]

function createChartData(source: Map<string, number>, formatLabel?: (key: string) => string) {
  return Array.from(source.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      key,
      label: formatLabel ? formatLabel(key) : key || 'Unspecified',
      value,
    }))
}

function createActivityTypeChartData(source: Map<string, number>) {
  const data: ChartDatum[] = ACTIVITY_TYPE_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    value: source.get(option.value) || 0,
  })).filter((entry) => entry.value > 0)

  const unspecifiedCount = source.get('') || 0
  if (unspecifiedCount > 0) {
    data.push({
      key: 'unspecified',
      label: 'Unspecified',
      value: unspecifiedCount,
    })
  }

  return data.sort((a, b) => b.value - a.value)
}

function incrementCounter(map: Map<string, number>, rawValue: string | null | undefined) {
  const key = String(rawValue || '')
  map.set(key, (map.get(key) || 0) + 1)
}

function handleDashboardCardKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  onOpen?: () => void
) {
  if (!onOpen) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onOpen()
  }
}

function PieChartCard({
  icon,
  title,
  data,
  total,
  onValueSelect,
  className = '',
}: {
  icon: string
  title: string
  data: ChartDatum[]
  total: number
  onValueSelect?: (item: ChartDatum) => void
  className?: string
}) {
  const hasData = total > 0 && data.length > 0

  let currentAngle = 0
  const slices = data.map((item, index) => {
    const percentage = item.value / total
    const sliceAngle = percentage * 360
    const startAngle = (currentAngle * Math.PI) / 180
    const endAngle = ((currentAngle + sliceAngle) * Math.PI) / 180

    const x1 = 50 + 50 * Math.cos(startAngle - Math.PI / 2)
    const y1 = 50 + 50 * Math.sin(startAngle - Math.PI / 2)
    const x2 = 50 + 50 * Math.cos(endAngle - Math.PI / 2)
    const y2 = 50 + 50 * Math.sin(endAngle - Math.PI / 2)
    const largeArc = sliceAngle > 180 ? 1 : 0
    const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`

    currentAngle += sliceAngle

    return (
      <path
        key={item.key}
        d={path}
        fill={CHART_COLORS[index % CHART_COLORS.length]}
        stroke="white"
        strokeWidth="0.5"
      />
    )
  })

  return (
    <section className={`dashboard-section dashboard-chart-card ${className}`.trim()}>
      <h3 className="dashboard-section-title">
        <span className="dashboard-section-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{title}</span>
      </h3>
      {hasData ? (
        <div className="chart-container">
          <div className="chart-pie">
            <svg viewBox="0 0 100 100" className="pie-chart" aria-hidden="true">
              {slices}
            </svg>
          </div>
          <div className="chart-legend">
            {data.map((item, index) => {
              const percentage = ((item.value / total) * 100).toFixed(1)

              return (
                <div key={item.key} className="legend-item">
                  <span
                    className="legend-color"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  ></span>
                  <span className="legend-label">{item.label}</span>
                  <button
                    type="button"
                    className="legend-value-button"
                    onClick={() => onValueSelect?.(item)}
                    disabled={!onValueSelect}
                  >
                    {item.value} ({percentage}%)
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="chart-empty-state">
          <p>No activities available for this chart yet.</p>
        </div>
      )}
    </section>
  )
}

function BarChartCard({
  icon,
  title,
  data,
  onValueSelect,
  className = '',
  controls,
}: {
  icon: string
  title: string
  data: ChartDatum[]
  onValueSelect?: (item: ChartDatum) => void
  className?: string
  controls?: React.ReactNode
}) {
  const hasData = data.length > 0
  const maxValue = hasData ? data[0].value : 0

  return (
    <section className={`dashboard-section dashboard-chart-card ${className}`.trim()}>
      <div className="dashboard-chart-card-header">
        <h3 className="dashboard-section-title">
          <span className="dashboard-section-icon" aria-hidden="true">
            {icon}
          </span>
          <span>{title}</span>
        </h3>
        {controls && <div className="dashboard-chart-card-controls">{controls}</div>}
      </div>
      {hasData ? (
        <div className="chart-list">
          {data.map((item) => (
            <div key={item.key} className="chart-item">
              <span className="chart-label" title={item.label}>
                {item.label}
              </span>
              <div className="chart-bar">
                <div
                  className="chart-fill"
                  style={{
                    width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <button
                type="button"
                className="chart-value chart-value-button"
                onClick={() => onValueSelect?.(item)}
                disabled={!onValueSelect}
              >
                {item.value}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart-empty-state">
          <p>No activities available for this chart yet.</p>
        </div>
      )}
    </section>
  )
}

export const Dashboard: React.FC<DashboardProps> = ({
  activities,
  recentActivities = [],
  performerName,
  onEdit,
  onDelete,
  isLoading = false,
  canEdit = true,
  canDelete = true,
  activeTeam,
  settings,
  onEditDenied,
  onDeleteDenied,
  onOpenActivityResults,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    myActivities: 0,
    activityByPerformer: new Map<string, number>(),
    activityByTag: new Map<string, number>(),
    activityBySystem: new Map<string, number>(),
    activityByShift: new Map<string, number>(),
    activityByInstrumentType: new Map<string, number>(),
    activityByType: new Map<string, number>(),
    recentActivities: [],
    recentlyEditedActivities: [],
    thisWeekActivities: 0,
  })
  const [topTagsLimit, setTopTagsLimit] = useState<10 | 20 | 30 | 50 | 100>(20)
  const systemFieldLabel = getSystemFieldLabel(activeTeam)

  useEffect(() => {
    const activityByPerformer = new Map<string, number>()
    const activityByTag = new Map<string, number>()
    const activityBySystem = new Map<string, number>()
    const activityByShift = new Map<string, number>()
    const activityByInstrumentType = new Map<string, number>()
    const activityByType = new Map<string, number>()

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    let weekCount = 0

    activities.forEach((activity) => {
      incrementCounter(activityByPerformer, activity.performer)
      incrementCounter(activityByTag, activity.tag)
      incrementCounter(activityBySystem, activity.system)
      incrementCounter(activityByShift, activity.shift)
      incrementCounter(activityByInstrumentType, activity.instrumentType)
      incrementCounter(activityByType, activity.activityType || '')

      if (activity.date >= weekAgo) {
        weekCount += 1
      }
    })

    const myActivities = activities.filter((activity) => activity.performer === performerName).length
    const recentActivities = activities.slice(0, 5)
    const recentlyEditedActivities = activities
      .filter((activity) => String(activity.editedBy || '').trim())
      .sort((first, second) => {
        const firstDate = first.edited_at || first.created_at || first.date || ''
        const secondDate = second.edited_at || second.created_at || second.date || ''
        return secondDate.localeCompare(firstDate)
      })
      .slice(0, 20)

    setStats({
      totalActivities: activities.length,
      myActivities,
      activityByPerformer,
      activityByTag,
      activityBySystem,
      activityByShift,
      activityByInstrumentType,
      activityByType,
      recentActivities,
      recentlyEditedActivities,
      thisWeekActivities: weekCount,
    })
  }, [activities, performerName])

  const systemChartData = createChartData(stats.activityBySystem)
  const performerChartData = createChartData(stats.activityByPerformer)
  const shiftChartData = createChartData(stats.activityByShift)
  const instrumentTypeChartData = createChartData(stats.activityByInstrumentType)
  const activityTypeChartData = createActivityTypeChartData(stats.activityByType)
  const tagChartData = createChartData(stats.activityByTag).slice(0, topTagsLimit)
  const thisWeekSinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const myActivitiesList = activities.filter((activity) => activity.performer === performerName)
  const recentlyEditedActivities = stats.recentlyEditedActivities
  const thisWeekActivitiesList = activities.filter((activity) => activity.date >= thisWeekSinceDate)
  const enabledCharts = useMemo(() => getEnabledDashboardCharts(settings), [settings])

  const openActivityResults = (request: DashboardActivityRequest) => {
    onOpenActivityResults?.(request)
  }

  const openActivityTypeResults = (item: ChartDatum) => {
    const targetType = item.key === 'unspecified' ? '' : item.key
    openActivityResults({
      title: `🧰 ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for ${item.label}.`,
      activities: activities.filter((activity) => (activity.activityType || '') === targetType),
      exportFilename: `Dashboard_Activity_Type_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'activityType', activityType: targetType },
    })
  }

  const openPerformerResults = (item: ChartDatum) => {
    openActivityResults({
      title: `👥 ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for performer ${item.label}.`,
      activities: activities.filter((activity) => (activity.performer || '') === item.key),
      exportFilename: `Dashboard_Performer_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'performer', performer: item.key },
    })
  }

  const openSystemResults = (item: ChartDatum) => {
    openActivityResults({
      title: `⚙️ ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for ${systemFieldLabel.toLowerCase()} ${item.label}.`,
      activities: activities.filter((activity) => (activity.system || '') === item.key),
      exportFilename: `Dashboard_${systemFieldLabel}_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'system', system: item.key },
    })
  }

  const openShiftResults = (item: ChartDatum) => {
    openActivityResults({
      title: `🌙 ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for shift ${item.label}.`,
      activities: activities.filter((activity) => (activity.shift || '') === item.key),
      exportFilename: `Dashboard_Shift_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'shift', shift: item.key },
    })
  }

  const openInstrumentTypeResults = (item: ChartDatum) => {
    openActivityResults({
      title: `🎛️ ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for instrument type ${item.label}.`,
      activities: activities.filter((activity) => (activity.instrumentType || '') === item.key),
      exportFilename: `Dashboard_Instrument_Type_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'instrumentType', instrumentType: item.key },
    })
  }

  const openTagResults = (item: ChartDatum) => {
    openActivityResults({
      title: `🏷️ ${item.label}`,
      description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} tagged with ${item.label}.`,
      activities: activities.filter((activity) => (activity.tag || '') === item.key),
      exportFilename: `Dashboard_Tag_${item.label.replace(/\s+/g, '_')}.xlsx`,
      filter: { kind: 'tag', tag: item.key },
    })
  }

  const chartCards: Record<DashboardChartKey, React.ReactNode> = {
    activityType: (
      <PieChartCard
        icon="🧰"
        title="Activities by Type"
        data={activityTypeChartData}
        total={stats.totalActivities}
        onValueSelect={openActivityTypeResults}
      />
    ),
    performer: (
      <PieChartCard
        icon="👥"
        title="Activities by Performer"
        data={performerChartData}
        total={stats.totalActivities}
        onValueSelect={openPerformerResults}
        className="performer-chart-card"
      />
    ),
    system: (
      <PieChartCard
        icon="⚙️"
        title={`Activities by ${systemFieldLabel}`}
        data={systemChartData}
        total={stats.totalActivities}
        onValueSelect={openSystemResults}
        className="system-chart-card"
      />
    ),
    shift: (
      <PieChartCard
        icon="🌙"
        title="Activities by Shift"
        data={shiftChartData}
        total={stats.totalActivities}
        onValueSelect={openShiftResults}
      />
    ),
    instrumentType: (
      <PieChartCard
        icon="🎛️"
        title="Activities by Instrument Type"
        data={instrumentTypeChartData}
        total={stats.totalActivities}
        onValueSelect={openInstrumentTypeResults}
      />
    ),
    topTags: (
      <BarChartCard
        icon="🏷️"
        title="Top Tags"
        data={tagChartData}
        onValueSelect={openTagResults}
        className="top-tags-chart-card"
        controls={
          <label className="dashboard-chart-select">
            <span>Show</span>
            <select
              value={topTagsLimit}
              onChange={(event) => setTopTagsLimit(Number(event.target.value) as 10 | 20 | 30 | 50 | 100)}
            >
              {[10, 20, 30, 50, 100].map((option) => (
                <option key={option} value={option}>
                  Top {option}
                </option>
              ))}
            </select>
          </label>
        }
      />
    ),
  }

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">
        <span className="dashboard-title-icon" aria-hidden="true">
          📊
        </span>
        <span>Comprehensive Dashboard</span>
      </h2>

      <div className="stats-grid">
        <div
          className={`stat-card ${onOpenActivityResults ? 'dashboard-card-actionable' : ''}`}
          onClick={() =>
            openActivityResults({
              title: '📈 Total Activities',
              description: `Showing all ${activities.length} recorded activities.`,
              exportFilename: 'Dashboard_Total_Activities.xlsx',
              filter: { kind: 'all' },
            })
          }
          onKeyDown={(event) =>
            handleDashboardCardKeyDown(event, () =>
              openActivityResults({
                title: '📈 Total Activities',
                description: `Showing all ${activities.length} recorded activities.`,
                exportFilename: 'Dashboard_Total_Activities.xlsx',
                filter: { kind: 'all' },
              })
            )
          }
          role={onOpenActivityResults ? 'button' : undefined}
          tabIndex={onOpenActivityResults ? 0 : undefined}
        >
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Total Activities</h3>
            <p className="stat-value">{stats.totalActivities}</p>
          </div>
        </div>

        <div
          className={`stat-card ${onOpenActivityResults ? 'dashboard-card-actionable' : ''}`}
          onClick={() =>
            openActivityResults({
              title: '👤 Your Activities',
              description: `Showing activities performed by ${performerName}.`,
              activities: myActivitiesList,
              exportFilename: 'Dashboard_My_Activities.xlsx',
              filter: { kind: 'performer', performer: performerName },
            })
          }
          onKeyDown={(event) =>
            handleDashboardCardKeyDown(event, () =>
              openActivityResults({
                title: '👤 Your Activities',
                description: `Showing activities performed by ${performerName}.`,
                activities: myActivitiesList,
                exportFilename: 'Dashboard_My_Activities.xlsx',
                filter: { kind: 'performer', performer: performerName },
              })
            )
          }
          role={onOpenActivityResults ? 'button' : undefined}
          tabIndex={onOpenActivityResults ? 0 : undefined}
        >
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <h3>Your Activities</h3>
            <p className="stat-value">{stats.myActivities}</p>
          </div>
        </div>

        <div
          className={`stat-card ${onOpenActivityResults ? 'dashboard-card-actionable' : ''}`}
          onClick={() =>
            openActivityResults({
              title: '📅 This Week Activities',
              description: 'Showing activities from the last 7 days.',
              activities: thisWeekActivitiesList,
              exportFilename: 'Dashboard_This_Week_Activities.xlsx',
              filter: { kind: 'sinceDate', sinceDate: thisWeekSinceDate },
            })
          }
          onKeyDown={(event) =>
            handleDashboardCardKeyDown(event, () =>
              openActivityResults({
                title: '📅 This Week Activities',
                description: 'Showing activities from the last 7 days.',
                activities: thisWeekActivitiesList,
                exportFilename: 'Dashboard_This_Week_Activities.xlsx',
                filter: { kind: 'sinceDate', sinceDate: thisWeekSinceDate },
              })
            )
          }
          role={onOpenActivityResults ? 'button' : undefined}
          tabIndex={onOpenActivityResults ? 0 : undefined}
        >
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>This Week Activities</h3>
            <p className="stat-value">{stats.thisWeekActivities}</p>
          </div>
        </div>

        <div
          className={`stat-card ${onOpenActivityResults ? 'dashboard-card-actionable' : ''}`}
          onClick={() =>
            openActivityResults({
              title: 'Recently Edited Activities',
              description: 'Showing the 20 most recently edited activities.',
              activities: recentlyEditedActivities,
              exportFilename: 'Dashboard_Recently_Edited_Activities.xlsx',
              filter: { kind: 'hasField', field: 'editedBy' },
            })
          }
          onKeyDown={(event) =>
            handleDashboardCardKeyDown(event, () =>
              openActivityResults({
                title: 'Recently Edited Activities',
                description: 'Showing the 20 most recently edited activities.',
                activities: recentlyEditedActivities,
                exportFilename: 'Dashboard_Recently_Edited_Activities.xlsx',
                filter: { kind: 'hasField', field: 'editedBy' },
              })
            )
          }
          role={onOpenActivityResults ? 'button' : undefined}
          tabIndex={onOpenActivityResults ? 0 : undefined}
        >
          <div className="stat-icon">✎</div>
          <div className="stat-content">
            <h3>Recently Edited</h3>
            <p className="stat-value">{recentlyEditedActivities.length}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-chart-grid">
        {enabledCharts.map((chart) => (
          <React.Fragment key={chart.key}>{chartCards[chart.key]}</React.Fragment>
        ))}
      </div>

      {stats.recentActivities.length > 0 && onEdit && onDelete && (
        <div className="dashboard-section recent-activities-table">
          <h3 className="dashboard-section-title">
            <span className="dashboard-section-icon" aria-hidden="true">
              📋
            </span>
            <span>Recent Activities</span>
          </h3>
          <ActivityList
            activities={recentActivities}
            onEdit={onEdit}
            onDelete={onDelete}
            activeTeam={activeTeam}
            settings={settings}
            isLoading={isLoading}
            canEdit={canEdit}
            canDelete={canDelete}
            onEditDenied={onEditDenied}
            onDeleteDenied={onDeleteDenied}
          />
        </div>
      )}
    </div>
  )
}
