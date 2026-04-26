import { type Activity, type Settings } from '../supabaseClient'

export type ConfigurableActivityFieldKey =
  | 'date'
  | 'performer'
  | 'system'
  | 'shift'
  | 'permitNumber'
  | 'instrumentType'
  | 'activityType'
  | 'tag'
  | 'problem'
  | 'action'
  | 'comments'

export interface ConfigurableActivityFieldState {
  enabled: boolean
  required: boolean
  order: number
}

export type ActivityFieldConfig = Record<ConfigurableActivityFieldKey, ConfigurableActivityFieldState>

export interface ActivityFieldDefinition {
  key: ConfigurableActivityFieldKey
  label: string
  placeholder: string
  type: 'text' | 'select' | 'textarea' | 'date'
  options?: string[]
  defaultEnabled: boolean
  defaultRequired: boolean
  defaultOrder: number
  searchable?: boolean
  tableBadge?: boolean
}

export const SHIFT_OPTIONS = ['Shift A', 'Shift B', 'Shift C', 'Shift D'] as const
export const INSTRUMENT_TYPE_OPTIONS = ['Inst.', 'F&GS'] as const

export const ACTIVITY_FIELD_DEFINITIONS: ActivityFieldDefinition[] = [
  {
    key: 'date',
    label: 'Date',
    placeholder: 'Select date',
    type: 'date',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 1,
    searchable: false,
  },
  {
    key: 'performer',
    label: 'Performer',
    placeholder: 'Select Performer',
    type: 'select',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 2,
    searchable: true,
  },
  {
    key: 'system',
    label: 'System',
    placeholder: 'Select System',
    type: 'select',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 3,
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
    defaultOrder: 4,
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
    defaultOrder: 5,
    searchable: true,
    tableBadge: true,
  },
  {
    key: 'instrumentType',
    label: 'Instrument Type',
    placeholder: 'Select instrument type',
    type: 'select',
    options: [...INSTRUMENT_TYPE_OPTIONS],
    defaultEnabled: false,
    defaultRequired: false,
    defaultOrder: 6,
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
    defaultOrder: 7,
    searchable: true,
  },
  {
    key: 'tag',
    label: 'Tag',
    placeholder: 'Enter tag',
    type: 'text',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 8,
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
    defaultOrder: 9,
    searchable: true,
  },
  {
    key: 'action',
    label: 'Action Taken',
    placeholder: 'Describe the action taken',
    type: 'textarea',
    defaultEnabled: true,
    defaultRequired: true,
    defaultOrder: 10,
    searchable: true,
  },
  {
    key: 'comments',
    label: 'Comments',
    placeholder: 'Any additional comments (optional)',
    type: 'textarea',
    defaultEnabled: true,
    defaultRequired: false,
    defaultOrder: 11,
    searchable: true,
  },
]

export const DEFAULT_ACTIVITY_FIELD_CONFIG: ActivityFieldConfig = ACTIVITY_FIELD_DEFINITIONS.reduce(
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

function getDefinition(key: ConfigurableActivityFieldKey) {
  return ACTIVITY_FIELD_DEFINITIONS.find((field) => field.key === key)
}

export function normalizeActivityFieldConfig(value: unknown): ActivityFieldConfig {
  const raw = typeof value === 'object' && value ? (value as Partial<Record<ConfigurableActivityFieldKey, Partial<ConfigurableActivityFieldState>>>) : {}

  return ACTIVITY_FIELD_DEFINITIONS.reduce((accumulator, field) => {
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
  return normalizeActivityFieldConfig(settings?.activity_field_config)
}

export function getOrderedActivityFields(settings?: Settings | null) {
  const config = getActivityFieldConfig(settings)

  return [...ACTIVITY_FIELD_DEFINITIONS].sort((first, second) => {
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
  return getOrderedActivityFields(settings).filter((field) => config[field.key].enabled)
}

export function isActivityFieldEnabled(settings: Settings | null | undefined, fieldKey: ConfigurableActivityFieldKey) {
  return getActivityFieldConfig(settings)[fieldKey].enabled
}

export function isActivityFieldRequired(settings: Settings | null | undefined, fieldKey: ConfigurableActivityFieldKey) {
  return getActivityFieldConfig(settings)[fieldKey].required
}

export function getActivityFieldLabel(fieldKey: ConfigurableActivityFieldKey) {
  return getDefinition(fieldKey)?.label || fieldKey
}

export function getActivityFieldValue(activity: Activity, fieldKey: ConfigurableActivityFieldKey) {
  return String(activity[fieldKey] || '')
}
