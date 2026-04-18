import React, { useRef, useState } from 'react'
import { type Activity, createActivities, createActivity } from '../supabaseClient'

interface ExcelImportProps {
  onImportSuccess: (result: ExcelImportResult) => void
  onImportError: (error: string) => void
  isLoading?: boolean
  currentUserName?: string
}

export interface ExcelImportResult {
  importedCount: number
  skippedCount: number
}

type ParsedWorksheetRow = Record<string, unknown>

const IMPORT_CHUNK_SIZE = 100

const COLUMN_ALIASES = {
  date: ['date', 'activitydate', 'workdate'],
  performer: ['performer', 'performedby', 'employee', 'engineer', 'technician', 'operator', 'name'],
  system: ['system', 'unit', 'area', 'department'],
  instrument: [
    'instrument',
    'instrumenttag',
    'instrumentnumber',
    'tag',
    'tagnumber',
    'tagno',
    'equipment',
    'asset',
  ],
  problem: ['problem', 'issue', 'fault', 'description', 'problemstatement'],
  action: ['action', 'actiontaken', 'resolution', 'solution', 'fix', 'remedy', 'correction'],
  comments: ['comments', 'comment', 'remarks', 'remark', 'notes', 'note', 'observations', 'observation'],
} as const

function formatDateParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatLocalDate(date: Date) {
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function formatUTCDate(date: Date) {
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function normalizeColumnKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeYear(year: number) {
  if (year >= 100) {
    return year
  }

  return year >= 70 ? 1900 + year : 2000 + year
}

function createDateString(year: number, month: number, day: number) {
  const normalizedYear = normalizeYear(year)
  const candidate = new Date(Date.UTC(normalizedYear, month - 1, day))

  if (
    candidate.getUTCFullYear() !== normalizedYear ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return ''
  }

  return formatUTCDate(candidate)
}

function excelSerialToDateString(value: number) {
  if (!Number.isFinite(value)) {
    return ''
  }

  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(value))
  return formatUTCDate(excelEpoch)
}

function normalizeDate(value: unknown) {
  if (!value) {
    return ''
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value)
  }

  if (typeof value === 'number') {
    return excelSerialToDateString(value)
  }

  const text = normalizeText(value)
  if (!text) {
    return ''
  }

  if (/^\d{1,6}(?:\.\d+)?$/.test(text)) {
    return excelSerialToDateString(Number(text))
  }

  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactMatch) {
    return createDateString(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]))
  }

  const yearFirstMatch = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/)
  if (yearFirstMatch) {
    return createDateString(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3])
    )
  }

  const yearLastMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/)
  if (yearLastMatch) {
    const first = Number(yearLastMatch[1])
    const second = Number(yearLastMatch[2])
    const year = Number(yearLastMatch[3])

    if (first > 12 && second <= 12) {
      return createDateString(year, second, first)
    }

    if (second > 12 && first <= 12) {
      return createDateString(year, first, second)
    }

    return createDateString(year, second, first) || createDateString(year, first, second)
  }

  const parsedDate = new Date(text)
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatLocalDate(parsedDate)
  }

  return ''
}

function getChunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getRowValue(row: ParsedWorksheetRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[alias]
    if (value !== undefined && normalizeText(value) !== '') {
      return value
    }
  }

  return ''
}

function isEmptyWorksheetRow(row: unknown[]) {
  return row.every((cell) => normalizeText(cell) === '')
}

export const ExcelImport: React.FC<ExcelImportProps> = ({
  onImportSuccess,
  onImportError,
  isLoading = false,
  currentUserName = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().match(/\.(xlsx?|xls)$/)) {
      onImportError('Please select a valid Excel file (.xlsx or .xls).')
      return
    }

    try {
      setIsImporting(true)
      setImportProgress(0)

      const workbookData = await file.arrayBuffer()
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(workbookData, { type: 'array', cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        raw: true,
        defval: '',
        blankrows: false,
      })

      if (rawRows.length <= 1) {
        onImportError('Excel file is empty or has no data rows.')
        return
      }

      const [headerRow, ...dataRows] = rawRows
      const normalizedHeaders = (headerRow || []).map((header) => normalizeColumnKey(header))
      const activities: Activity[] = []
      const errorRows: string[] = []

      dataRows.forEach((row, dataIndex) => {
        if (!Array.isArray(row) || isEmptyWorksheetRow(row)) {
          return
        }

        const normalizedRow = normalizedHeaders.reduce<ParsedWorksheetRow>((accumulator, header, columnIndex) => {
          if (header) {
            accumulator[header] = row[columnIndex]
          }
          return accumulator
        }, {})

        const activity: Activity = {
          date: normalizeDate(getRowValue(normalizedRow, COLUMN_ALIASES.date)),
          performer:
            normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.performer)) ||
            currentUserName ||
            'Unknown',
          system: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.system)),
          instrument: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.instrument)),
          problem: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.problem)),
          action: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.action)),
          comments: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.comments)),
        }

        if (
          !activity.date ||
          !activity.performer ||
          !activity.system ||
          !activity.instrument ||
          !activity.problem ||
          !activity.action
        ) {
          errorRows.push(`Row ${dataIndex + 2}: Missing or invalid required fields.`)
          return
        }

        activities.push(activity)
      })

      if (activities.length === 0) {
        onImportError(
          `No valid activities found. ${
            errorRows.length > 0 ? errorRows.slice(0, 3).join(' ') : ''
          }`.trim()
        )
        return
      }

      let processedCount = 0
      let successCount = 0

      for (const chunk of getChunk(activities, IMPORT_CHUNK_SIZE)) {
        try {
          await createActivities(chunk)
          successCount += chunk.length
          processedCount += chunk.length
          setImportProgress(Math.round((processedCount / activities.length) * 100))
          continue
        } catch (bulkError) {
          console.warn('Bulk import chunk failed, retrying rows individually:', bulkError)
        }

        for (const activity of chunk) {
          try {
            await createActivity(activity)
            successCount++
          } catch (rowError) {
            errorRows.push(
              `${activity.date || 'Unknown date'} / ${activity.instrument || 'Unknown instrument'}: ${
                rowError instanceof Error ? rowError.message : 'Unknown error'
              }`
            )
          } finally {
            processedCount++
            setImportProgress(Math.round((processedCount / activities.length) * 100))
          }
        }
      }

      if (successCount === 0) {
        onImportError(
          `Import failed. ${
            errorRows.length > 0 ? errorRows.slice(0, 3).join(' ') : 'No rows were inserted.'
          }`.trim()
        )
        return
      }

      onImportSuccess({
        importedCount: successCount,
        skippedCount: errorRows.length,
      })

      if (errorRows.length > 0) {
        console.warn('Import completed with warnings:', errorRows.slice(0, 20).join(' | '))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process Excel file.'
      onImportError(message)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setImportProgress(0)
      setIsImporting(false)
    }
  }

  return (
    <div className="excel-import-container">
      <div className="excel-import-section">
        <h3>Import Activities from Excel</h3>
        <p className="excel-hint">
          Upload an Excel file to bulk import activities. Supported date inputs include Excel date
          cells, `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY/MM/DD`, and month-name formats.
        </p>

        <div className="excel-input-group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isImporting || isLoading}
            className="file-input"
            id="excel-file-input"
          />
          <label htmlFor="excel-file-input" className="btn btn-primary">
            {isImporting ? 'Importing...' : 'Choose Excel File'}
          </label>
        </div>

        {isImporting && (
          <div className="import-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${importProgress}%` }}></div>
            </div>
            <p className="progress-text">{importProgress}% - Importing activities...</p>
          </div>
        )}

        <div className="excel-template-hint">
          <p><strong>Expected Excel Format:</strong></p>
          <table className="template-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Performer</th>
                <th>System</th>
                <th>Instrument</th>
                <th>Problem</th>
                <th>Action</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2024-04-15</td>
                <td>John Doe</td>
                <td>DCS</td>
                <td>Sensor A</td>
                <td>Reading error</td>
                <td>Recalibrated sensor</td>
                <td>Normal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
