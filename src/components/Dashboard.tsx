import React, { useEffect, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { Activity } from '../supabaseClient'
import { ActivityList } from './ActivityList'

interface DashboardProps {
  activities: Activity[]
  performerName: string
  onEdit?: (activity: Activity) => void
  onDelete?: (id: string) => Promise<void>
  isLoading?: boolean
  canDelete?: boolean
  onDeleteDenied?: () => void
}

interface DashboardStats {
  totalActivities: number
  myActivities: number
  uniqueTags: number
  uniqueSystems: number
  activityByPerformer: Map<string, number>
  activityByTag: Map<string, number>
  activityBySystem: Map<string, number>
  activityByType: Map<string, number>
  recentActivities: Activity[]
  todayActivities: number
  thisWeekActivities: number
}

interface ChartDatum {
  key: string
  label: string
  value: number
}

const CHART_COLORS = [
  '#667eea',
  '#764ba2',
  '#f093fb',
  '#4facfe',
  '#00f2fe',
  '#43e97b',
  '#fa7231',
  '#ffa502',
  '#ff6b6b',
  '#ee5a6f',
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

  return data
}

function PieChartCard({
  icon,
  title,
  data,
  total,
}: {
  icon: string
  title: string
  data: ChartDatum[]
  total: number
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
    <section className="dashboard-section dashboard-chart-card">
      <h3>
        {icon} {title}
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
                  <span className="legend-label">
                    {item.label}: {item.value} ({percentage}%)
                  </span>
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
}: {
  icon: string
  title: string
  data: ChartDatum[]
}) {
  const hasData = data.length > 0
  const maxValue = hasData ? data[0].value : 0

  return (
    <section className="dashboard-section dashboard-chart-card">
      <h3>
        {icon} {title}
      </h3>
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
              <span className="chart-value">{item.value}</span>
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
  performerName,
  onEdit,
  onDelete,
  isLoading = false,
  canDelete = true,
  onDeleteDenied,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    myActivities: 0,
    uniqueTags: 0,
    uniqueSystems: 0,
    activityByPerformer: new Map<string, number>(),
    activityByTag: new Map<string, number>(),
    activityBySystem: new Map<string, number>(),
    activityByType: new Map<string, number>(),
    recentActivities: [],
    todayActivities: 0,
    thisWeekActivities: 0,
  })

  useEffect(() => {
    const activityByPerformer = new Map<string, number>()
    const activityByTag = new Map<string, number>()
    const activityBySystem = new Map<string, number>()
    const activityByType = new Map<string, number>()

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let todayCount = 0
    let weekCount = 0

    activities.forEach((activity) => {
      activityByPerformer.set(activity.performer, (activityByPerformer.get(activity.performer) || 0) + 1)
      activityByTag.set(activity.tag, (activityByTag.get(activity.tag) || 0) + 1)
      activityBySystem.set(activity.system, (activityBySystem.get(activity.system) || 0) + 1)
      activityByType.set(activity.activityType || '', (activityByType.get(activity.activityType || '') || 0) + 1)

      if (activity.date === today) {
        todayCount += 1
      }

      if (activity.date >= weekAgo) {
        weekCount += 1
      }
    })

    const myActivities = activities.filter((activity) => activity.performer === performerName).length
    const recentActivities = activities.slice(0, 5)

    setStats({
      totalActivities: activities.length,
      myActivities,
      uniqueTags: activityByTag.size,
      uniqueSystems: activityBySystem.size,
      activityByPerformer,
      activityByTag,
      activityBySystem,
      activityByType,
      recentActivities,
      todayActivities: todayCount,
      thisWeekActivities: weekCount,
    })
  }, [activities, performerName])

  const systemChartData = createChartData(stats.activityBySystem)
  const performerChartData = createChartData(stats.activityByPerformer)
  const activityTypeChartData = createActivityTypeChartData(stats.activityByType)
  const tagChartData = createChartData(stats.activityByTag).slice(0, 10)

  return (
    <div className="dashboard">
      <h2>📊 Comprehensive Dashboard</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Total Activities</h3>
            <p className="stat-value">{stats.totalActivities}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <h3>Your Activities</h3>
            <p className="stat-value">{stats.myActivities}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚙️</div>
          <div className="stat-content">
            <h3>Systems Covered</h3>
            <p className="stat-value">{stats.uniqueSystems}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏷️</div>
          <div className="stat-content">
            <h3>Tags Used</h3>
            <p className="stat-value">{stats.uniqueTags}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Team Members</h3>
            <p className="stat-value">{stats.activityByPerformer.size}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>This Week</h3>
            <p className="stat-value">{stats.thisWeekActivities}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-chart-grid">
        <PieChartCard
          icon="🧰"
          title="Activities by Type"
          data={activityTypeChartData}
          total={stats.totalActivities}
        />
        <PieChartCard
          icon="👥"
          title="Activities by Performer"
          data={performerChartData}
          total={stats.totalActivities}
        />
        <PieChartCard
          icon="⚙️"
          title="Activities by System"
          data={systemChartData}
          total={stats.totalActivities}
        />
        <BarChartCard icon="🏷️" title="Top Tags" data={tagChartData} />
      </div>

      {stats.recentActivities.length > 0 && onEdit && onDelete && (
        <div className="dashboard-section recent-activities-table">
          <h3>📋 Recent Activities</h3>
          <ActivityList
            activities={stats.recentActivities}
            onEdit={onEdit}
            onDelete={onDelete}
            isLoading={isLoading}
            canDelete={canDelete}
            onDeleteDenied={onDeleteDenied}
          />
        </div>
      )}
    </div>
  )
}
