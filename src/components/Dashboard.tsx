import React, { useState, useEffect } from 'react'
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
  uniqueInstruments: number
  uniqueSystems: number
  activityByPerformer: Map<string, number>
  activityByInstrument: Map<string, number>
  activityBySystem: Map<string, number>
  recentActivities: Activity[]
  todayActivities: number
  thisWeekActivities: number
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
    uniqueInstruments: 0,
    uniqueSystems: 0,
    activityByPerformer: new Map<string, number>(),
    activityByInstrument: new Map<string, number>(),
    activityBySystem: new Map<string, number>(),
    recentActivities: [],
    todayActivities: 0,
    thisWeekActivities: 0,
  })

  useEffect(() => {
    // Calculate statistics
    const activityByPerformer = new Map<string, number>()
    const activityByInstrument = new Map<string, number>()
    const activityBySystem = new Map<string, number>()

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let todayCount = 0
    let weekCount = 0

    activities.forEach((activity) => {
      // Count by performer
      activityByPerformer.set(
        activity.performer,
        (activityByPerformer.get(activity.performer) || 0) + 1
      )

      // Count by instrument
      activityByInstrument.set(
        activity.instrument,
        (activityByInstrument.get(activity.instrument) || 0) + 1
      )

      // Count by system
      activityBySystem.set(
        activity.system,
        (activityBySystem.get(activity.system) || 0) + 1
      )

      // Count today and this week
      if (activity.date === today) {
        todayCount++
      }
      if (activity.date >= weekAgo) {
        weekCount++
      }
    })

    const myActivities = activities.filter((a) => a.performer === performerName).length
    const recentActivities = activities.slice(0, 5)

    setStats({
      totalActivities: activities.length,
      myActivities,
      uniqueInstruments: activityByInstrument.size,
      uniqueSystems: activityBySystem.size,
      activityByPerformer,
      activityByInstrument,
      activityBySystem,
      recentActivities,
      todayActivities: todayCount,
      thisWeekActivities: weekCount,
    })
  }, [activities, performerName])

  return (
    <div className="dashboard">
      <h2>📊 Comprehensive Dashboard</h2>

      {/* Key Statistics */}
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
            <h3>Instruments Used</h3>
            <p className="stat-value">{stats.uniqueInstruments}</p>
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

      {/* Activity by System - Pie Chart */}
      <div className="dashboard-section">
        <h3>⚙️ Activities by System</h3>
        <div className="chart-container">
          <div className="chart-pie">
            <svg viewBox="0 0 100 100" className="pie-chart">
              {Array.from(stats.activityBySystem.entries()).reduce(
                (acc, [system, count], index, arr) => {
                  const total = stats.totalActivities
                  const percentage = (count / total) * 100
                  const colors = [
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
                  const color = colors[index % colors.length]

                  const startAngle = (acc.angle * Math.PI) / 180
                  const endAngle = ((acc.angle + (percentage * 3.6)) * Math.PI) / 180

                  const x1 = 50 + 50 * Math.cos(startAngle - Math.PI / 2)
                  const y1 = 50 + 50 * Math.sin(startAngle - Math.PI / 2)
                  const x2 = 50 + 50 * Math.cos(endAngle - Math.PI / 2)
                  const y2 = 50 + 50 * Math.sin(endAngle - Math.PI / 2)

                  const largeArc = percentage > 50 ? 1 : 0

                  const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`

                  acc.elements.push(
                    <path key={system} d={path} fill={color} stroke="white" strokeWidth="0.5" />
                  )

                  return {
                    angle: acc.angle + percentage * 3.6,
                    elements: acc.elements,
                  }
                },
                { angle: 0, elements: [] as JSX.Element[] }
              ).elements}
            </svg>
          </div>
          <div className="chart-legend">
            {Array.from(stats.activityBySystem.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([system, count], index) => {
                const colors = [
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
                const color = colors[index % colors.length]
                const percentage = ((count / stats.totalActivities) * 100).toFixed(1)

                return (
                  <div key={system} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: color }}></span>
                    <span className="legend-label">
                      {system}: {count} ({percentage}%)
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Activity by Performer - Pie Chart */}
      <div className="dashboard-section">
        <h3>👥 Activities by Performer</h3>
        <div className="chart-container">
          <div className="chart-pie">
            <svg viewBox="0 0 100 100" className="pie-chart">
              {Array.from(stats.activityByPerformer.entries()).reduce(
                (acc, [performer, count], index, arr) => {
                  const total = stats.totalActivities
                  const percentage = (count / total) * 100
                  const colors = [
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
                  const color = colors[index % colors.length]

                  const startAngle = (acc.angle * Math.PI) / 180
                  const endAngle = ((acc.angle + (percentage * 3.6)) * Math.PI) / 180

                  const x1 = 50 + 50 * Math.cos(startAngle - Math.PI / 2)
                  const y1 = 50 + 50 * Math.sin(startAngle - Math.PI / 2)
                  const x2 = 50 + 50 * Math.cos(endAngle - Math.PI / 2)
                  const y2 = 50 + 50 * Math.sin(endAngle - Math.PI / 2)

                  const largeArc = percentage > 50 ? 1 : 0

                  const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`

                  acc.elements.push(
                    <path key={performer} d={path} fill={color} stroke="white" strokeWidth="0.5" />
                  )

                  return {
                    angle: acc.angle + percentage * 3.6,
                    elements: acc.elements,
                  }
                },
                { angle: 0, elements: [] as JSX.Element[] }
              ).elements}
            </svg>
          </div>
          <div className="chart-legend">
            {Array.from(stats.activityByPerformer.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([performer, count], index) => {
                const colors = [
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
                const color = colors[index % colors.length]
                const percentage = ((count / stats.totalActivities) * 100).toFixed(1)

                return (
                  <div key={performer} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: color }}></span>
                    <span className="legend-label">
                      {performer}: {count} ({percentage}%)
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Top Instruments - Horizontal Bar Chart */}
      <div className="dashboard-section">
        <h3>🏷️ Top Instruments</h3>
        <div className="chart-list">
          {Array.from(stats.activityByInstrument.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([instrument, count]) => (
              <div key={instrument} className="chart-item">
                <span className="chart-label">{instrument}</span>
                <div className="chart-bar">
                  <div
                    className="chart-fill"
                    style={{
                      width: `${(count / stats.totalActivities) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="chart-value">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Activities - Modern Table */}
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
