import { type Settings } from '../supabaseClient'

export interface ResponsiveColumnConfig {
  mobile: number
  tablet: number
  desktop: number
}

export interface LayoutConfig {
  activityFormColumns: ResponsiveColumnConfig
  searchFilterColumns: ResponsiveColumnConfig
  dashboardChartColumns: ResponsiveColumnConfig
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  activityFormColumns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  searchFilterColumns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  dashboardChartColumns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
}

function clampColumns(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.max(1, Math.min(4, Math.round(numericValue)))
}

function normalizeResponsiveColumns(value: unknown, fallback: ResponsiveColumnConfig): ResponsiveColumnConfig {
  const raw = typeof value === 'object' && value ? (value as Partial<ResponsiveColumnConfig>) : {}

  return {
    mobile: clampColumns(raw.mobile, fallback.mobile),
    tablet: clampColumns(raw.tablet, fallback.tablet),
    desktop: clampColumns(raw.desktop, fallback.desktop),
  }
}

export function normalizeLayoutConfig(value: unknown): LayoutConfig {
  const raw = typeof value === 'object' && value ? (value as Partial<LayoutConfig>) : {}

  return {
    activityFormColumns: normalizeResponsiveColumns(raw.activityFormColumns, DEFAULT_LAYOUT_CONFIG.activityFormColumns),
    searchFilterColumns: normalizeResponsiveColumns(raw.searchFilterColumns, DEFAULT_LAYOUT_CONFIG.searchFilterColumns),
    dashboardChartColumns: normalizeResponsiveColumns(raw.dashboardChartColumns, DEFAULT_LAYOUT_CONFIG.dashboardChartColumns),
  }
}

export function getLayoutConfig(settings?: Settings | null) {
  return normalizeLayoutConfig(settings?.layout_config)
}
