import { type Settings } from '../supabaseClient'

export type DashboardChartKey =
  | 'activityType'
  | 'performer'
  | 'system'
  | 'shift'
  | 'instrumentType'
  | 'topTags'

export interface DashboardChartConfigItem {
  enabled: boolean
  order: number
}

export type DashboardChartConfig = Record<DashboardChartKey, DashboardChartConfigItem>

export interface DashboardChartDefinition {
  key: DashboardChartKey
  label: string
  defaultEnabled: boolean
  defaultOrder: number
}

export const DASHBOARD_CHART_DEFINITIONS: DashboardChartDefinition[] = [
  { key: 'activityType', label: 'Activities by Type', defaultEnabled: true, defaultOrder: 1 },
  { key: 'performer', label: 'Activities by Performer', defaultEnabled: true, defaultOrder: 2 },
  { key: 'system', label: 'Activities by System', defaultEnabled: true, defaultOrder: 3 },
  { key: 'shift', label: 'Activities by Shift', defaultEnabled: true, defaultOrder: 4 },
  { key: 'instrumentType', label: 'Activities by Instrument Type', defaultEnabled: true, defaultOrder: 5 },
  { key: 'topTags', label: 'Top Tags', defaultEnabled: true, defaultOrder: 6 },
]

export const DEFAULT_DASHBOARD_CHART_CONFIG: DashboardChartConfig = DASHBOARD_CHART_DEFINITIONS.reduce(
  (accumulator, chart) => {
    accumulator[chart.key] = {
      enabled: chart.defaultEnabled,
      order: chart.defaultOrder,
    }
    return accumulator
  },
  {} as DashboardChartConfig
)

export function normalizeDashboardChartConfig(value: unknown): DashboardChartConfig {
  const raw =
    typeof value === 'object' && value
      ? (value as Partial<Record<DashboardChartKey, Partial<DashboardChartConfigItem>>>)
      : {}

  return DASHBOARD_CHART_DEFINITIONS.reduce((accumulator, chart) => {
    const rawChart = raw[chart.key]
    accumulator[chart.key] = {
      enabled: typeof rawChart?.enabled === 'boolean' ? rawChart.enabled : chart.defaultEnabled,
      order: Number.isFinite(Number(rawChart?.order)) ? Number(rawChart?.order) : chart.defaultOrder,
    }
    return accumulator
  }, {} as DashboardChartConfig)
}

export function getDashboardChartConfig(settings?: Settings | null) {
  return normalizeDashboardChartConfig(settings?.dashboard_chart_config)
}

export function getOrderedDashboardCharts(settings?: Settings | null) {
  const config = getDashboardChartConfig(settings)

  return [...DASHBOARD_CHART_DEFINITIONS].sort((first, second) => {
    const firstOrder = config[first.key]?.order ?? first.defaultOrder
    const secondOrder = config[second.key]?.order ?? second.defaultOrder

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder
    }

    return first.defaultOrder - second.defaultOrder
  })
}

export function getEnabledDashboardCharts(settings?: Settings | null) {
  const config = getDashboardChartConfig(settings)
  return getOrderedDashboardCharts(settings).filter((chart) => config[chart.key].enabled)
}
