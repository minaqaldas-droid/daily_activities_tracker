import { type Settings } from '../supabaseClient'
import {
  getActivityFieldDefinitions,
  getCoreActivityFieldDefinitions,
  normalizeStoredActivityFieldDefinitions,
  type BaseActivityFieldKey,
} from './activityFields'

export type DashboardChartKey = string

export interface DashboardChartConfigItem {
  enabled: boolean
  order: number
}

export type DashboardChartConfig = Record<DashboardChartKey, DashboardChartConfigItem>

export interface DashboardChartDefinition {
  key: string
  label: string
  fieldKey: string
  chartType: 'pie' | 'bar'
  enabled: boolean
  order: number
  maxItems?: number
  includeEmpty?: boolean
}

export interface StoredDashboardChartDefinition {
  key: string
  label: string
  fieldKey: string
  chartType: 'pie' | 'bar'
  maxItems?: number
  includeEmpty?: boolean
  archived?: boolean
}

const BASE_DASHBOARD_CHART_DEFINITIONS: DashboardChartDefinition[] = [
  { key: 'activityType', label: 'Activities by Type', fieldKey: 'activityType', chartType: 'pie', enabled: true, order: 1, maxItems: 6, includeEmpty: false },
  { key: 'performer', label: 'Activities by Performer', fieldKey: 'performer', chartType: 'pie', enabled: true, order: 2, maxItems: 6, includeEmpty: false },
  { key: 'system', label: 'Activities by System', fieldKey: 'system', chartType: 'pie', enabled: true, order: 3, maxItems: 6, includeEmpty: false },
  { key: 'shift', label: 'Activities by Shift', fieldKey: 'shift', chartType: 'pie', enabled: true, order: 4, maxItems: 6, includeEmpty: false },
  { key: 'instrumentType', label: 'Activities by Instrument Type', fieldKey: 'instrumentType', chartType: 'pie', enabled: true, order: 5, maxItems: 6, includeEmpty: false },
  { key: 'topTags', label: 'Top Tags', fieldKey: 'tag', chartType: 'bar', enabled: true, order: 6, maxItems: 6, includeEmpty: false },
]

export function getCoreDashboardChartDefinitions(): DashboardChartDefinition[] {
  return BASE_DASHBOARD_CHART_DEFINITIONS.map((chart) => ({ ...chart }))
}

export const DEFAULT_DASHBOARD_CHART_CONFIG: DashboardChartConfig = BASE_DASHBOARD_CHART_DEFINITIONS.reduce(
  (accumulator, chart) => {
    accumulator[chart.key] = {
      enabled: chart.enabled,
      order: chart.order,
    }
    return accumulator
  },
  {} as DashboardChartConfig
)

export const DEFAULT_DASHBOARD_CHART_DEFINITIONS: StoredDashboardChartDefinition[] = []

function getBaseChartDefinition(key: string) {
  return BASE_DASHBOARD_CHART_DEFINITIONS.find((chart) => chart.key === key)
}

function hasExplicitChartSelection(definitions: StoredDashboardChartDefinition[]) {
  const storedKeys = new Set(definitions.map((definition) => definition.key))
  return BASE_DASHBOARD_CHART_DEFINITIONS.every((chart) => storedKeys.has(chart.key))
}

function hasExplicitActivityFieldSelection(settings?: Settings | null) {
  const storedFields = normalizeStoredActivityFieldDefinitions(settings?.activity_field_definitions)
  if (storedFields.length === 0) {
    return false
  }

  const storedKeys = new Set(storedFields.map((field) => field.key))
  return getCoreActivityFieldDefinitions().every((field) => storedKeys.has(field.key))
}

function normalizeChartKey(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((segment, index) =>
      index === 0 ? segment.charAt(0).toLowerCase() + segment.slice(1) : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join('')
}

export function normalizeStoredDashboardChartDefinitions(value: unknown, settings?: Settings | null) {
  if (!Array.isArray(value)) {
    return []
  }

  const validFieldKeys = new Set(getActivityFieldDefinitions(settings).map((field) => field.key))
  const seenKeys = new Set<string>()
  const normalizedDefinitions: StoredDashboardChartDefinition[] = []

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const raw = item as Partial<StoredDashboardChartDefinition>
    const key = normalizeChartKey(String(raw.key || raw.label || ''))
    const label = String(raw.label || '').trim()
    const fieldKey = String(raw.fieldKey || '').trim()
    const chartType = raw.chartType
    const isArchived = Boolean(raw.archived)

    if (!key || !label || !fieldKey || !chartType || !['pie', 'bar'].includes(chartType) || (!isArchived && !validFieldKeys.has(fieldKey))) {
      return
    }

    if (seenKeys.has(key)) {
      return
    }

    seenKeys.add(key)
    normalizedDefinitions.push({
      key,
      label,
      fieldKey,
      chartType,
      maxItems: Number.isFinite(Number(raw.maxItems)) ? Math.max(1, Number(raw.maxItems)) : undefined,
      includeEmpty: Boolean(raw.includeEmpty),
      archived: isArchived,
    })
  })

  return normalizedDefinitions
}

export function getDashboardChartDefinitions(settings?: Settings | null): DashboardChartDefinition[] {
  const storedDefinitions = normalizeStoredDashboardChartDefinitions(settings?.dashboard_chart_definitions, settings)
  const explicitChartSelection = hasExplicitChartSelection(storedDefinitions)
  const usesExplicitEditorSelection = explicitChartSelection || hasExplicitActivityFieldSelection(settings)
  const overridesByKey = new Map(storedDefinitions.map((definition) => [definition.key, definition]))

  const baseCharts: DashboardChartDefinition[] = []
  if (!usesExplicitEditorSelection) {
    BASE_DASHBOARD_CHART_DEFINITIONS.forEach((chart) => {
      const override = overridesByKey.get(chart.key)
      if (override?.archived) {
        return
      }

      baseCharts.push({
        ...chart,
        label: override?.label || chart.label,
        fieldKey: override?.fieldKey || chart.fieldKey,
        chartType: override?.chartType || chart.chartType,
        maxItems: override?.maxItems ?? chart.maxItems,
        includeEmpty: override?.includeEmpty ?? chart.includeEmpty,
      })
    })
  }

  const customCharts = storedDefinitions
    .filter((chart) => !chart.archived && (usesExplicitEditorSelection || !getBaseChartDefinition(chart.key)))
    .map((chart, index) => ({
      key: chart.key,
      label: chart.label,
      fieldKey: chart.fieldKey,
      chartType: chart.chartType,
      maxItems: chart.maxItems,
      includeEmpty: chart.includeEmpty,
      enabled: true,
      order: baseCharts.length + index + 1,
    }))

  if (usesExplicitEditorSelection) {
    return customCharts
  }

  return [...baseCharts, ...customCharts]
}

export function normalizeDashboardChartConfig(value: unknown, definitions: DashboardChartDefinition[] = BASE_DASHBOARD_CHART_DEFINITIONS) {
  const raw = typeof value === 'object' && value ? (value as Partial<Record<string, Partial<DashboardChartConfigItem>>>) : {}

  return definitions.reduce((accumulator, chart) => {
    const rawChart = raw[chart.key]
    accumulator[chart.key] = {
      enabled: typeof rawChart?.enabled === 'boolean' ? rawChart.enabled : chart.enabled,
      order: Number.isFinite(Number(rawChart?.order)) ? Number(rawChart?.order) : chart.order,
    }
    return accumulator
  }, {} as DashboardChartConfig)
}

export function getDashboardChartConfig(settings?: Settings | null): DashboardChartConfig {
  return normalizeDashboardChartConfig(settings?.dashboard_chart_config, getDashboardChartDefinitions(settings))
}

export function getOrderedDashboardCharts(settings?: Settings | null) {
  const config = getDashboardChartConfig(settings)

  return [...getDashboardChartDefinitions(settings)].sort((first, second) => {
    const firstOrder = config[first.key]?.order ?? first.order
    const secondOrder = config[second.key]?.order ?? second.order

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder
    }

    return first.order - second.order
  })
}

export function getEnabledDashboardCharts(settings?: Settings | null) {
  const config = getDashboardChartConfig(settings)
  return getOrderedDashboardCharts(settings).filter((chart) => config[chart.key]?.enabled)
}

export function getDefaultDashboardChartLabelForField(fieldKey: string) {
  const baseLabels: Partial<Record<BaseActivityFieldKey, string>> = {
    activityType: 'Activities by Type',
    performer: 'Activities by Performer',
    system: 'Activities by System',
    shift: 'Activities by Shift',
    instrumentType: 'Activities by Instrument Type',
    tag: 'Top Tags',
  }

  return baseLabels[fieldKey as BaseActivityFieldKey] || `Activities by ${fieldKey}`
}
