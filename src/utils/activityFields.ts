import { type Activity, type Settings } from '../supabaseClient'

export type BaseActivityFieldKey =
  | 'date'
  | 'performer'
  | 'system'
  | 'shift'
  | 'permitNumber'
  | 'instrumentType'
  | 'activityType'
  | 'mocActivity'
  | 'tag'
  | 'problem'
  | 'action'
  | 'comments'

export type ConfigurableActivityFieldKey = string

export interface ConfigurableActivityFieldState {
  enabled: boolean
  required: boolean
  order: number
}

export type ActivityFieldConfig = Record<string, ConfigurableActivityFieldState>

export interface ActivityFieldDefinition {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'select' | 'textarea' | 'date' | 'checkbox'
  options?: string[]
  defaultEnabled: boolean
  defaultRequired: boolean
  defaultOrder: number
  searchable?: boolean
  tableBadge?: boolean
  isCustom?: boolean
}

export interface StoredActivityFieldDefinition {
  key: string
  label: string
  placeholder?: string
  type: 'text' | 'select' | 'textarea' | 'date' | 'checkbox'
  options?: string[]
  searchable?: boolean
  tableBadge?: boolean
  archived?: boolean
}

export const SHIFT_OPTIONS = ['A', 'B', 'C', 'D'] as const

const BASE_ACTIVITY_FIELD_DEFINITIONS: ActivityFieldDefinition[] = [
  {
    key: 'date',
    label: 'Date',
    placeholder: 'Select date',
    type: 'date',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 10,
    searchable: false,
  },
  {
    key: 'performer',
    label: 'Performer',
    placeholder: 'Enter performer',
    type: 'text',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 20,
    searchable: true,
  },
  {
    key: 'system',
    label: 'System',
    placeholder: 'Select System',
    type: 'select',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 30,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'shift',
    label: 'Shift',
    placeholder: 'Select Shift',
    type: 'select',
    options: [...SHIFT_OPTIONS],
    defaultEnabled: false,
    defaultRequired: false,
    defaultOrder: 40,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'permitNumber',
    label: 'Permit Number',
    placeholder: 'Enter permit number',
    type: 'text',
    defaultEnabled: false,
    defaultRequired: false,
    defaultOrder: 50,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'instrumentType',
    label: 'Instrument Type',
    placeholder: 'Enter instrument type',
    type: 'text',
    defaultEnabled: false,
    defaultRequired: false,
    defaultOrder: 60,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'activityType',
    label: 'Activity Type',
    placeholder: 'Select Activity Type',
    type: 'select',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 70,
    searchable: true,
  },
  {
    key: 'mocActivity',
    label: 'MOC',
    placeholder: 'Prefixes comments with {MOC} when selected',
    type: 'checkbox',
    defaultEnabled: true,
    defaultRequired: false,
    defaultOrder: 75,
    searchable: true,
  },
  {
    key: 'tag',
    label: 'Tag',
    placeholder: 'Enter tag',
    type: 'text',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 80,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'problem',
    label: 'Problem',
    placeholder: 'Describe the problem encountered',
    type: 'textarea',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 90,
    searchable: true,
  },
  {
    key: 'action',
    label: 'Action Taken',
    placeholder: 'Describe the action taken',
    type: 'textarea',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 100,
    searchable: true,
  },
  {
    key: 'comments',
    label: 'Comments',
    placeholder: 'Any additional comments (optional)',
    type: 'textarea',
    defaultEnabled: true,
    defaultRequired: false,
    defaultOrder: 110,
    searchable: true,
  },
]

export function getCoreActivityFieldDefinitions(): ActivityFieldDefinition[] {
  return BASE_ACTIVITY_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }))
}

export const DEFAULT_ACTIVITY_FIELD_CONFIG: ActivityFieldConfig = BASE_ACTIVITY_FIELD_DEFINITIONS.reduce(
  (accumulator, field) => {
    accumulator[field.key] = {
      enabled: field.defaultEnabled,
      required: field.defaultRequired,
      order: field.defaultOrder,
    }
    return accumulator
  },
  {} as ActivityFieldConfig
)

export const DEFAULT_ACTIVITY_FIELD_DEFINITIONS: StoredActivityFieldDefinition[] = []

function slugifyLabel(value: string) {
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

export function normalizeFieldKey(value: string) {
  const normalized = slugifyLabel(value)
  return normalized || `field${Date.now()}`
}

function getBaseDefinition(key: string) {
  return BASE_ACTIVITY_FIELD_DEFINITIONS.find((field) => field.key === key)
}

export function normalizeStoredActivityFieldDefinitions(value: unknown): StoredActivityFieldDefinition[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seenKeys = new Set<string>()
  const normalizedDefinitions: StoredActivityFieldDefinition[] = []

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const raw = item as Partial<StoredActivityFieldDefinition>
    const key = normalizeFieldKey(String(raw.key || raw.label || ''))
    const label = String(raw.label || '').trim()
    const type = raw.type

    if (!key || !label || !type || !['text', 'select', 'textarea', 'date', 'checkbox'].includes(type)) {
      return
    }

    if (seenKeys.has(key)) {
      return
    }

    seenKeys.add(key)
    normalizedDefinitions.push({
      key,
      label,
      placeholder: String(raw.placeholder || (type === 'checkbox' ? label : `Enter ${label.toLowerCase()}`)),
      type,
      options: type === 'select' && Array.isArray(raw.options) ? raw.options.map((option) => String(option).trim()).filter(Boolean) : [],
      searchable: raw.searchable !== false,
      tableBadge: Boolean(raw.tableBadge),
      archived: Boolean(raw.archived),
    })
  })

  return normalizedDefinitions
}

export function getActivityFieldDefinitions(settings?: Settings | null) {
  const storedDefinitions = normalizeStoredActivityFieldDefinitions(settings?.activity_field_definitions)
  const overridesByKey = new Map(storedDefinitions.map((definition) => [definition.key, definition]))
  const customFieldStartOrder = BASE_ACTIVITY_FIELD_DEFINITIONS.length * 10 + 10

  const baseDefinitions: ActivityFieldDefinition[] = []
  BASE_ACTIVITY_FIELD_DEFINITIONS.forEach((field) => {
    const override = overridesByKey.get(field.key)
    if (override?.archived) {
      return
    }

    baseDefinitions.push({
      ...field,
      label: override?.label || field.label,
      placeholder: override?.placeholder || field.placeholder,
      type: field.key === 'performer' ? 'text' : override?.type || field.type,
      options: field.key === 'performer' ? [] : override?.type === 'select' ? override.options || field.options || [] : field.options,
      searchable: override?.searchable ?? field.searchable,
      tableBadge: override?.tableBadge ?? field.tableBadge,
    })
  })

  const normalizedCustomDefinitions: ActivityFieldDefinition[] = storedDefinitions
    .filter((field) => !getBaseDefinition(field.key) && !field.archived)
    .map((field, index) => ({
    key: field.key,
    label: field.label,
    placeholder: field.placeholder || (field.type === 'checkbox' ? field.label : `Enter ${field.label.toLowerCase()}`),
    type: field.type,
    options: field.type === 'select' ? field.options || [] : [],
    defaultEnabled: true,
    defaultRequired: false,
    defaultOrder: customFieldStartOrder + index * 10,
    searchable: field.searchable !== false,
    tableBadge: Boolean(field.tableBadge),
    isCustom: true,
  }))

  return [...baseDefinitions, ...normalizedCustomDefinitions]
}

export function normalizeActivityFieldConfig(value: unknown, definitions: ActivityFieldDefinition[] = BASE_ACTIVITY_FIELD_DEFINITIONS) {
  const raw = typeof value === 'object' && value ? (value as Partial<Record<string, Partial<ConfigurableActivityFieldState>>>) : {}

  return definitions.reduce((accumulator, field) => {
    const rawField = raw[field.key]

    accumulator[field.key] = {
      enabled: typeof rawField?.enabled === 'boolean' ? rawField.enabled : field.defaultEnabled,
      required:
        typeof rawField?.required === 'boolean'
          ? rawField.required && (typeof rawField?.enabled === 'boolean' ? rawField.enabled : field.defaultEnabled)
          : field.defaultRequired,
      order: Number.isFinite(Number(rawField?.order)) ? Number(rawField?.order) : field.defaultOrder,
    }

    if (!accumulator[field.key].enabled) {
      accumulator[field.key].required = false
    }

    return accumulator
  }, {} as ActivityFieldConfig)
}

export function getActivityFieldConfig(settings?: Settings | null) {
  const definitions = getActivityFieldDefinitions(settings)
  const config = normalizeActivityFieldConfig(settings?.activity_field_config, definitions)
  const rawConfig =
    typeof settings?.activity_field_config === 'object' && settings?.activity_field_config
      ? (settings.activity_field_config as Partial<Record<string, Partial<ConfigurableActivityFieldState>>>)
      : {}

  if (definitions.some((field) => field.key === 'mocActivity') && !rawConfig.mocActivity && typeof settings?.show_moc_activity === 'boolean') {
    config.mocActivity = {
      ...config.mocActivity,
      enabled: settings.show_moc_activity,
      required: settings.show_moc_activity ? config.mocActivity?.required ?? false : false,
    }
  }

  return config
}

export function getOrderedActivityFields(settings?: Settings | null): ActivityFieldDefinition[] {
  const definitions = getActivityFieldDefinitions(settings)
  const config = getActivityFieldConfig(settings)

  return [...definitions].sort((first, second) => {
    const firstOrder = config[first.key]?.order ?? first.defaultOrder
    const secondOrder = config[second.key]?.order ?? second.defaultOrder

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder
    }

    return first.defaultOrder - second.defaultOrder
  })
}

export function getEnabledActivityFields(settings?: Settings | null) {
  const config = getActivityFieldConfig(settings)
  return getOrderedActivityFields(settings).filter((field) => config[field.key]?.enabled)
}

export function isActivityFieldEnabled(settings: Settings | null | undefined, fieldKey: string) {
  return Boolean(getActivityFieldConfig(settings)[fieldKey]?.enabled)
}

export function isActivityFieldRequired(settings: Settings | null | undefined, fieldKey: string) {
  return Boolean(getActivityFieldConfig(settings)[fieldKey]?.required)
}

export function getActivityFieldDefinition(settings: Settings | null | undefined, fieldKey: string) {
  return getActivityFieldDefinitions(settings).find((field) => field.key === fieldKey)
}

export function getActivityFieldLabel(fieldKey: string, settings?: Settings | null) {
  return getActivityFieldDefinition(settings, fieldKey)?.label || fieldKey
}

export function getActivityFieldValue(activity: Activity, fieldKey: string) {
  if (fieldKey === 'mocActivity') {
    return String(activity.customFields?.mocActivity || '')
  }

  if (fieldKey in activity) {
    const directValue = activity[fieldKey as keyof Activity]
    return String(directValue || '')
  }

  return String(activity.customFields?.[fieldKey] || '')
}

export function setActivityFieldValue(activity: Activity, fieldKey: string, value: string | boolean) {
  const normalizedValue = typeof value === 'boolean' ? (value ? 'true' : '') : value

  if (fieldKey === 'mocActivity') {
    return {
      ...activity,
      customFields: {
        ...(activity.customFields || {}),
        mocActivity: normalizedValue,
      },
    }
  }

  if (getBaseDefinition(fieldKey)) {
    return {
      ...activity,
      [fieldKey]: normalizedValue,
    }
  }

  return {
    ...activity,
    customFields: {
      ...(activity.customFields || {}),
      [fieldKey]: normalizedValue,
    },
  }
}
