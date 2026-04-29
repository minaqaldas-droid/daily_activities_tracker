export const ACTIVITY_TYPE_OPTIONS = [
  {
    value: 'PM',
    shortLabel: 'PM',
    label: 'PM (Preventive Maintenance)',
  },
  {
    value: 'CM',
    shortLabel: 'CM',
    label: 'CM (Corrective Maintenance)',
  },
  {
    value: 'Mod',
    shortLabel: 'Mod',
    label: 'Mod (Modification)',
  },
  {
    value: 'SD Activity',
    shortLabel: 'SD',
    label: 'SD Activity',
  },
] as const

export type ActivityTypeValue = (typeof ACTIVITY_TYPE_OPTIONS)[number]['value']

function getActivityTypeOption(value?: string | null) {
  return ACTIVITY_TYPE_OPTIONS.find((option) => option.value === value)
}

export function getActivityTypeLabel(value?: string | null) {
  return getActivityTypeOption(value)?.label || value?.trim() || 'Unspecified'
}

export function getActivityTypeShortLabel(value?: string | null) {
  return getActivityTypeOption(value)?.shortLabel || value?.trim() || 'Unspecified'
}

export function getActivityTypeBadgeClassName(value?: string | null) {
  switch (value) {
    case 'PM':
      return 'type-pm'
    case 'CM':
      return 'type-cm'
    case 'Mod':
      return 'type-mod'
    case 'SD Activity':
      return 'type-sd'
    default:
      return 'type-unknown'
  }
}

export function normalizeImportedActivityType(value: string): ActivityTypeValue | '' {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, '')

  if (!normalized) {
    return ''
  }

  if (normalized === 'pm' || normalized === 'preventivemaintenance' || normalized === 'preventive') {
    return 'PM'
  }

  if (normalized === 'cm' || normalized === 'correctivemaintenance' || normalized === 'corrective') {
    return 'CM'
  }

  if (normalized === 'mod' || normalized === 'modification') {
    return 'Mod'
  }

  if (normalized === 'sdactivity' || normalized === 'sd') {
    return 'SD Activity'
  }

  return ''
}
