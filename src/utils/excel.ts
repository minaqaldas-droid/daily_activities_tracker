import { type Activity, type Settings } from '../supabaseClient'
import { getActivityFieldValue, getEnabledActivityFields } from './activityFields'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function normalizeFilename(filename: string) {
  const sanitized = filename.trim().replace(/[\\/:*?"<>|]+/g, '_')
  const fallback = `Activities_${new Date().toISOString().split('T')[0]}`
  const normalized = sanitized || fallback

  return normalized.toLowerCase().endsWith('.xlsx') ? normalized : `${normalized}.xlsx`
}

function getTimestampFromDate(dateValue: string) {
  const match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return Number.NEGATIVE_INFINITY
  }

  const [, year, month, day] = match
  const timestamp = Date.parse(`${year}-${month}-${day}T00:00:00Z`)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

function sortActivitiesByDateDescending(activities: Activity[]) {
  return [...activities].sort((first, second) => {
    const secondDate = getTimestampFromDate(second.date)
    const firstDate = getTimestampFromDate(first.date)

    if (secondDate !== firstDate) {
      return secondDate - firstDate
    }

    return (second.created_at || '').localeCompare(first.created_at || '')
  })
}

function buildExportRows(activities: Activity[], systemFieldLabel: string, settings?: Settings) {
  const enabledActivityFields = getEnabledActivityFields(settings).filter((field) => field.type !== 'checkbox')

  return sortActivitiesByDateDescending(activities).map((activity) => ({
    Date: formatExcelDate(activity.date),
    Performer: activity.performer,
    'Activity Type': activity.activityType || '',
    [systemFieldLabel]: activity.system,
    ...enabledActivityFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.label] = getActivityFieldValue(activity, field.key)
      return acc
    }, {}),
    Tag: activity.tag,
    Problem: activity.problem,
    Action: activity.action,
    Comments: activity.comments || '',
  }))
}

function formatExcelDate(value: string) {
  const trimmedValue = value.trim()
  const match = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return trimmedValue
  }

  const [, year, month, day] = match
  const monthIndex = Number(month) - 1

  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) {
    return trimmedValue
  }

  return `${Number(day)}-${MONTH_NAMES[monthIndex]}-${year}`
}

function applyWorksheetFormatting(
  worksheet: Record<string, unknown>,
  XLSX: Awaited<typeof import('xlsx')>
) {
  const range = typeof worksheet['!ref'] === 'string' ? worksheet['!ref'] : null
  if (!range) {
    return
  }

  const borderStyle = {
    top: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
  }

  const decodedRange = XLSX.utils.decode_range(range)
  for (let row = decodedRange.s.r; row <= decodedRange.e.r; row += 1) {
    for (let col = decodedRange.s.c; col <= decodedRange.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = worksheet[cellAddress] as { s?: Record<string, unknown> } | undefined
      if (!cell) {
        continue
      }

      cell.s = {
        ...(cell.s || {}),
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderStyle,
      }
    }
  }
}

export async function exportActivitiesToExcel(
  activities: Activity[],
  options: {
    filename?: string
    sheetName?: string
    systemFieldLabel?: string
    settings?: Settings
  } = {}
) {
  if (activities.length === 0) {
    throw new Error('No activities found to export.')
  }

  const XLSX = await import('xlsx')
  const enabledActivityFields = getEnabledActivityFields(options.settings).filter((field) => field.type !== 'checkbox')

  const worksheet = XLSX.utils.json_to_sheet(
    buildExportRows(activities, options.systemFieldLabel || 'System', options.settings)
  )
  const workbook = XLSX.utils.book_new()

  worksheet['!cols'] = enabledActivityFields.map((field) => {
    if (field.key === 'date') return { wch: 12 }
    if (field.key === 'performer') return { wch: 18 }
    if (field.key === 'system' || field.key === 'shift' || field.key === 'activityType') return { wch: 14 }
    if (field.key === 'permitNumber' || field.key === 'instrumentType' || field.key === 'tag') return { wch: 16 }
    return { wch: 30 }
  })

  applyWorksheetFormatting(worksheet as Record<string, unknown>, XLSX)

  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Activities')

  const filename = normalizeFilename(options.filename || `Activities_${new Date().toISOString().split('T')[0]}`)
  XLSX.writeFile(workbook, filename, { cellStyles: true })

  return filename
}
