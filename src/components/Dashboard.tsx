import React, { useMemo, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import { type DashboardResultsFilter } from '../types/activityResults'
import { getActivityFieldLabel, getActivityFieldValue } from '../utils/activityFields'
import { getEnabledDashboardCards, type DashboardCardDefinition } from '../utils/dashboardCards'
import { getEnabledDashboardCharts, type DashboardChartDefinition } from '../utils/dashboardCharts'
import { getLayoutConfig } from '../utils/layoutConfig'
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
  canManageChartDisplayCounts?: boolean
  onUpdateChartDisplayCount?: (chartKey: string, maxItems: number) => void
}

interface ChartDatum {
  key: string
  label: string
  value: number
}

const DASHBOARD_CHART_ITEM_LIMIT_OPTIONS = [4, 6, 8, 10, 20, 30, 50, 100]
const DEFAULT_CHART_ITEM_LIMIT = 6

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

function createActivityTypeChartData(activities: Activity[]) {
  const counts = ACTIVITY_TYPE_OPTIONS.reduce<Record<string, number>>((accumulator, option) => {
    accumulator[option.value] = 0
    return accumulator
  }, {})

  activities.forEach((activity) => {
    const key = activity.activityType || ''
    counts[key] = (counts[key] || 0) + 1
  })

  const data: ChartDatum[] = ACTIVITY_TYPE_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    value: counts[option.value] || 0,
  })).filter((item) => item.value > 0)

  if (counts[''] > 0) {
    data.push({ key: '', label: 'Unspecified', value: counts[''] })
  }

  return data.sort((first, second) => second.value - first.value)
}

function createFieldChartData(
  activities: Activity[],
  fieldKey: string,
  options: { includeEmpty?: boolean; limit?: number; settings?: Settings | null; activeTeam?: Team | null }
) {
  const counts = new Map<string, number>()

  activities.forEach((activity) => {
    const rawValue = getActivityFieldValue(activity, fieldKey)
    const key = rawValue.trim()

    if (!options.includeEmpty && !key) {
      return
    }

    counts.set(key, (counts.get(key) || 0) + 1)
  })

  const fallbackLabel = getActivityFieldLabel(fieldKey, options.settings)
  const data = Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([key, value]) => ({
      key,
      label:
        fieldKey === 'system' && key
          ? key
          : key || `Unspecified ${fallbackLabel}`,
      value,
    }))

  if (options.limit && options.limit > 0) {
    return data.slice(0, options.limit)
  }

  return data
}

function handleDashboardCardKeyDown(event: React.KeyboardEvent<HTMLElement>, onOpen?: () => void) {
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
  chartKey,
  maxItems,
  canManageDisplayCount = false,
  onUpdateDisplayCount,
  className = '',
}: {
  icon: string
  title: string
  data: ChartDatum[]
  total: number
  onValueSelect?: (item: ChartDatum) => void
  chartKey: string
  maxItems: number
  canManageDisplayCount?: boolean
  onUpdateDisplayCount?: (chartKey: string, maxItems: number) => void
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

    return <path key={`${item.key}-${index}`} d={path} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="white" strokeWidth="0.5" />
  })

  return (
    <section className={`dashboard-section dashboard-chart-card ${className}`.trim()}>
      <div className="dashboard-chart-card-header">
        <h3 className="dashboard-section-title">
          <span className="dashboard-section-icon" aria-hidden="true">
            {icon}
          </span>
          <span>{title}</span>
        </h3>
        {canManageDisplayCount && onUpdateDisplayCount ? (
          <label className="dashboard-chart-count-control">
            <span>Items</span>
            <select value={maxItems} onChange={(event) => onUpdateDisplayCount(chartKey, Number(event.target.value))}>
              {DASHBOARD_CHART_ITEM_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
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
                  <span className="legend-color" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></span>
                  <span className="legend-label">{item.label}</span>
                  <button type="button" className="legend-value-button" onClick={() => onValueSelect?.(item)} disabled={!onValueSelect}>
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
  chartKey,
  maxItems,
  canManageDisplayCount = false,
  onUpdateDisplayCount,
  className = '',
}: {
  icon: string
  title: string
  data: ChartDatum[]
  onValueSelect?: (item: ChartDatum) => void
  chartKey: string
  maxItems: number
  canManageDisplayCount?: boolean
  onUpdateDisplayCount?: (chartKey: string, maxItems: number) => void
  className?: string
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
        {canManageDisplayCount && onUpdateDisplayCount ? (
          <label className="dashboard-chart-count-control">
            <span>Items</span>
            <select value={maxItems} onChange={(event) => onUpdateDisplayCount(chartKey, Number(event.target.value))}>
              {DASHBOARD_CHART_ITEM_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {hasData ? (
        <div className="chart-list">
          {data.map((item) => (
            <div key={item.key} className="chart-item">
              <span className="chart-label" title={item.label}>
                {item.label}
              </span>
              <div className="chart-bar">
                <div className="chart-fill" style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}></div>
              </div>
              <button type="button" className="chart-value chart-value-button" onClick={() => onValueSelect?.(item)} disabled={!onValueSelect}>
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

function getChartIcon(fieldKey: string, chartType: 'pie' | 'bar') {
  if (fieldKey === 'activityType') return '🧰'
  if (fieldKey === 'performer') return '👥'
  if (fieldKey === 'system') return '⚙️'
  if (fieldKey === 'shift') return '🌙'
  if (fieldKey === 'instrumentType') return '🎛️'
  if (fieldKey === 'tag') return '🏷️'
  return chartType === 'pie' ? '📊' : '📶'
}

function useResponsiveColumns(baseColumns: { mobile: number; tablet: number; desktop: number }) {
  const [columns, setColumns] = useState(baseColumns.desktop)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateColumns = () => {
      if (window.innerWidth <= 640) {
        setColumns(baseColumns.mobile)
        return
      }

      if (window.innerWidth <= 1024) {
        setColumns(baseColumns.tablet)
        return
      }

      setColumns(baseColumns.desktop)
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [baseColumns.desktop, baseColumns.mobile, baseColumns.tablet])

  return columns
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
  canManageChartDisplayCounts = false,
  onUpdateChartDisplayCount,
}) => {
  const thisWeekSinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const enabledCharts = useMemo(() => getEnabledDashboardCharts(settings), [settings])
  const enabledCards = useMemo(() => getEnabledDashboardCards(settings), [settings])
  const layoutConfig = getLayoutConfig(settings)
  const chartColumns = useResponsiveColumns(layoutConfig.dashboardChartColumns)
  const systemFieldLabel = getSystemFieldLabel(activeTeam)

  const myActivitiesList = useMemo(
    () => activities.filter((activity) => activity.performer === performerName),
    [activities, performerName]
  )
  const thisWeekActivitiesList = useMemo(
    () => activities.filter((activity) => activity.date >= thisWeekSinceDate),
    [activities, thisWeekSinceDate]
  )
  const recentlyEditedActivities = useMemo(
    () =>
      [...activities]
        .filter((activity) => String(activity.edited_at || '').trim())
        .sort((first, second) => (second.edited_at || '').localeCompare(first.edited_at || ''))
        .slice(0, 20),
    [activities]
  )

  const openActivityResults = (request: DashboardActivityRequest) => onOpenActivityResults?.(request)

  const renderDashboardCard = (card: DashboardCardDefinition) => {
    let value = 0
    let filter: DashboardResultsFilter | undefined
    let activitiesForRequest: Activity[] | undefined

    switch (card.metric) {
      case 'totalActivities':
        value = activities.length
        filter = { kind: 'all' }
        break
      case 'myActivities':
        value = myActivitiesList.length
        filter = { kind: 'performer', performer: performerName }
        activitiesForRequest = myActivitiesList
        break
      case 'thisWeekActivities':
        value = thisWeekActivitiesList.length
        filter = { kind: 'sinceDate', sinceDate: thisWeekSinceDate }
        activitiesForRequest = thisWeekActivitiesList
        break
      case 'recentlyEditedCount':
        value = recentlyEditedActivities.length
        filter = { kind: 'recentlyEdited', limit: 20 }
        activitiesForRequest = recentlyEditedActivities
        break
      case 'fieldValueCount':
        if (card.fieldKey) {
          activitiesForRequest = activities.filter(
            (activity) => getActivityFieldValue(activity, card.fieldKey || '') === (card.fieldValue || '')
          )
          value = activitiesForRequest.length
          filter = { kind: 'fieldValue', fieldKey: card.fieldKey, fieldValue: card.fieldValue || '' }
        }
        break
      case 'fieldHasValueCount':
        if (card.fieldKey) {
          activitiesForRequest = activities.filter((activity) => String(getActivityFieldValue(activity, card.fieldKey || '') || '').trim())
          value = activitiesForRequest.length
          filter = { kind: 'fieldHasValue', fieldKey: card.fieldKey }
        }
        break
      default:
        break
    }

    return (
      <div
        key={card.key}
        className={`stat-card ${onOpenActivityResults ? 'dashboard-card-actionable' : ''}`}
        onClick={() =>
          openActivityResults({
            title: `${card.icon} ${card.label}`.trim(),
            description: card.description || `Showing ${card.label.toLowerCase()}.`,
            activities: activitiesForRequest,
            exportFilename: `${card.label.replace(/\s+/g, '_')}.xlsx`,
            filter,
          })
        }
        onKeyDown={(event) =>
          handleDashboardCardKeyDown(event, () =>
            openActivityResults({
              title: `${card.icon} ${card.label}`.trim(),
              description: card.description || `Showing ${card.label.toLowerCase()}.`,
              activities: activitiesForRequest,
              exportFilename: `${card.label.replace(/\s+/g, '_')}.xlsx`,
              filter,
            })
          )
        }
        role={onOpenActivityResults ? 'button' : undefined}
        tabIndex={onOpenActivityResults ? 0 : undefined}
      >
        <div className="stat-icon">{card.icon}</div>
        <div className="stat-content">
          <h3>{card.label}</h3>
          <p className="stat-value">{value}</p>
        </div>
      </div>
    )
  }

  const renderChartCard = (chart: DashboardChartDefinition) => {
    const chartCardClassName =
      chart.key === 'topTags' || chart.fieldKey === 'tag'
        ? 'top-tags-chart-card'
        : chart.fieldKey === 'performer'
          ? 'performer-chart-card'
          : chart.fieldKey === 'system'
            ? 'system-chart-card'
            : ''
    const data =
      chart.fieldKey === 'activityType'
        ? createActivityTypeChartData(activities).slice(0, chart.maxItems || DEFAULT_CHART_ITEM_LIMIT)
        : createFieldChartData(activities, chart.fieldKey, {
            includeEmpty: chart.includeEmpty,
            limit: chart.maxItems,
            settings,
            activeTeam,
          })

    const onValueSelect = (item: ChartDatum) => {
      openActivityResults({
        title: chart.label,
        description: `Showing ${item.value} activit${item.value === 1 ? 'y' : 'ies'} for ${item.label}.`,
        filter: { kind: 'fieldValue', fieldKey: chart.fieldKey, fieldValue: item.key },
        exportFilename: `${chart.label.replace(/\s+/g, '_')}.xlsx`,
      })
    }

    const icon = getChartIcon(chart.fieldKey, chart.chartType)
    const total = data.reduce((sum, item) => sum + item.value, 0)

    if (chart.chartType === 'bar') {
      return (
        <BarChartCard
          key={chart.key}
          className={chartCardClassName}
          chartKey={chart.key}
          icon={icon}
          title={chart.label}
          data={data}
          maxItems={chart.maxItems || DEFAULT_CHART_ITEM_LIMIT}
          canManageDisplayCount={canManageChartDisplayCounts}
          onUpdateDisplayCount={onUpdateChartDisplayCount}
          onValueSelect={onValueSelect}
        />
      )
    }

    return (
      <PieChartCard
        key={chart.key}
        className={chartCardClassName}
        chartKey={chart.key}
        icon={icon}
        title={chart.label}
        data={data}
        total={total}
        maxItems={chart.maxItems || DEFAULT_CHART_ITEM_LIMIT}
        canManageDisplayCount={canManageChartDisplayCounts}
        onUpdateDisplayCount={onUpdateChartDisplayCount}
        onValueSelect={onValueSelect}
      />
    )
  }

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">
        <span className="dashboard-title-icon" aria-hidden="true">
          📊
        </span>
        <span>Dashboard</span>
      </h2>

      <div className="stats-grid">{enabledCards.map((card) => renderDashboardCard(card))}</div>

      <div className="dashboard-chart-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${chartColumns}, minmax(0, 1fr))`, gap: '1.5rem' }}>
        {enabledCharts.map((chart) => (
          <React.Fragment key={chart.key}>{renderChartCard(chart)}</React.Fragment>
        ))}
      </div>

      {recentActivities.length > 0 && onEdit && onDelete && (
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
