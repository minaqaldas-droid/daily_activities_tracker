import { SYSTEM_OPTIONS } from '../constants/systems'

export function getSystemFieldLabel(_team?: unknown) {
  return 'System'
}

export function getSystemFieldLabelPlural(_team?: unknown) {
  return 'Systems'
}

export function getSystemFieldOptions(_team?: unknown) {
  return [...SYSTEM_OPTIONS]
}
