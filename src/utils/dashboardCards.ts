import { type Settings } from '../supabaseClient'

export type DashboardCardKey = string

export interface DashboardCardConfigItem {
  enabled: boolean
  order: number
}

export type DashboardCardConfig = Record<string, DashboardCardConfigItem>

export type DashboardCardMetric =
  | 'totalActivities'
  | 'myActivities'
  | 'thisWeekActivities'
  | 'recentlyEditedCount'
  | 'fieldValueCount'
  | 'fieldHasValueCount'

export interface DashboardCardDefinition {
  key: string
  label: string
  metric: DashboardCardMetric
  icon: string
  fieldKey?: string
  fieldValue?: string
  description?: string
  enabled: boolean
  order: number
}

export interface StoredDashboardCardDefinition {
  key: string
  label: string
  metric: DashboardCardMetric
  icon?: string
  fieldKey?: string
  fieldValue?: string
  description?: string
  archived?: boolean
}

const BASE_DASHBOARD_CARD_DEFINITIONS: DashboardCardDefinition[] = [
  { key: 'totalActivities', label: 'Total Activities', metric: 'totalActivities', icon: '📈', description: 'Showing all recorded activities.', enabled: true, order: 1 },
  { key: 'myActivities', label: 'Your Activities', metric: 'myActivities', icon: '👤', description: 'Showing activities performed by the signed-in user.', enabled: true, order: 2 },
  { key: 'thisWeekActivities', label: 'This Week Activities', metric: 'thisWeekActivities', icon: '🗓️', description: 'Showing activities from the last 7 days.', enabled: true, order: 3 },
  { key: 'recentlyEdited', label: 'Recently Edited', metric: 'recentlyEditedCount', icon: '✏️', description: 'Showing the 20 most recently edited activities.', enabled: true, order: 4 },
]

export function getCoreDashboardCardDefinitions(): DashboardCardDefinition[] {
  return BASE_DASHBOARD_CARD_DEFINITIONS.map((card) => ({ ...card }))
}

export const DEFAULT_DASHBOARD_CARD_CONFIG: DashboardCardConfig = BASE_DASHBOARD_CARD_DEFINITIONS.reduce(
  (accumulator, card) => {
    accumulator[card.key] = { enabled: card.enabled, order: card.order }
    return accumulator
  },
  {} as DashboardCardConfig
)

export const DEFAULT_DASHBOARD_CARD_DEFINITIONS: StoredDashboardCardDefinition[] = []

function normalizeCardKey(value: string) {
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

function getBaseCardDefinition(key: string) {
  return BASE_DASHBOARD_CARD_DEFINITIONS.find((card) => card.key === key)
}

export function normalizeStoredDashboardCardDefinitions(value: unknown): StoredDashboardCardDefinition[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seenKeys = new Set<string>()
  const normalized: StoredDashboardCardDefinition[] = []

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const raw = item as Partial<StoredDashboardCardDefinition>
    const key = normalizeCardKey(String(raw.key || raw.label || ''))
    const label = String(raw.label || '').trim()
    const metric = raw.metric

    if (!key || !label || !metric || !['totalActivities', 'myActivities', 'thisWeekActivities', 'recentlyEditedCount', 'fieldValueCount', 'fieldHasValueCount'].includes(metric)) {
      return
    }

    if (seenKeys.has(key)) {
      return
    }

    seenKeys.add(key)
    normalized.push({
      key,
      label,
      metric,
      icon: String(raw.icon || ''),
      fieldKey: raw.fieldKey ? String(raw.fieldKey) : undefined,
      fieldValue: raw.fieldValue ? String(raw.fieldValue) : undefined,
      description: raw.description ? String(raw.description) : undefined,
      archived: Boolean(raw.archived),
    })
  })

  return normalized
}

export function getDashboardCardDefinitions(settings?: Settings | null): DashboardCardDefinition[] {
  const storedDefinitions = normalizeStoredDashboardCardDefinitions(settings?.dashboard_card_definitions)
  const overridesByKey = new Map(storedDefinitions.map((definition) => [definition.key, definition]))

  const baseCards: DashboardCardDefinition[] = []
  BASE_DASHBOARD_CARD_DEFINITIONS.forEach((card) => {
    const override = overridesByKey.get(card.key)
    if (override?.archived) {
      return
    }

    baseCards.push({
      ...card,
      label: override?.label || card.label,
      metric: override?.metric || card.metric,
      icon: override?.icon || card.icon,
      fieldKey: override?.fieldKey || card.fieldKey,
      fieldValue: override?.fieldValue || card.fieldValue,
      description: override?.description || card.description,
    })
  })

  const customCards = storedDefinitions
    .filter((card) => !getBaseCardDefinition(card.key) && !card.archived)
    .map((card, index) => ({
      key: card.key,
      label: card.label,
      metric: card.metric,
      icon: card.icon || '📊',
      fieldKey: card.fieldKey,
      fieldValue: card.fieldValue,
      description: card.description,
      enabled: true,
      order: baseCards.length + index + 1,
    }))

  return [...baseCards, ...customCards]
}

export function normalizeDashboardCardConfig(value: unknown, definitions: DashboardCardDefinition[] = BASE_DASHBOARD_CARD_DEFINITIONS): DashboardCardConfig {
  const raw = typeof value === 'object' && value ? (value as Partial<Record<string, Partial<DashboardCardConfigItem>>>) : {}

  return definitions.reduce((accumulator, card) => {
    const rawCard = raw[card.key]
    accumulator[card.key] = {
      enabled: typeof rawCard?.enabled === 'boolean' ? rawCard.enabled : card.enabled,
      order: Number.isFinite(Number(rawCard?.order)) ? Number(rawCard?.order) : card.order,
    }
    return accumulator
  }, {} as DashboardCardConfig)
}

export function getDashboardCardConfig(settings?: Settings | null): DashboardCardConfig {
  return normalizeDashboardCardConfig(settings?.dashboard_card_config, getDashboardCardDefinitions(settings))
}

export function getOrderedDashboardCards(settings?: Settings | null): DashboardCardDefinition[] {
  const config = getDashboardCardConfig(settings)
  return [...getDashboardCardDefinitions(settings)].sort((first, second) => {
    const firstOrder = config[first.key]?.order ?? first.order
    const secondOrder = config[second.key]?.order ?? second.order
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder
    }
    return first.order - second.order
  })
}

export function getEnabledDashboardCards(settings?: Settings | null): DashboardCardDefinition[] {
  const config = getDashboardCardConfig(settings)
  return getOrderedDashboardCards(settings).filter((card) => config[card.key]?.enabled)
}
