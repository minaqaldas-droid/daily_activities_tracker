import React, { useRef, useState } from 'react'
import { normalizeImportedActivityType } from '../constants/activityTypes'
import { type Activity, createActivities, createActivity } from '../supabaseClient'
import { parseImportedDate } from '../utils/date'

interface ExcelImportProps {
  onImportSuccess: (result: ExcelImportResult) => void
  onImportError: (error: string) => void
  isLoading?: boolean
}

export interface ExcelImportResult {
  importedCount: number
  skippedCount: number
}

type ParsedWorksheetRow = Record<string, unknown>
type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } }

const IMPORT_CHUNK_SIZE = 100

const COLUMN_ALIASES = {
  date: ['date', 'activitydate', 'workdate'],
  performer: ['performer', 'performedby', 'employee', 'engineer', 'technician', 'operator', 'name'],
  system: ['system', 'unit', 'area', 'department'],
  activityType: ['activitytype', 'type', 'maintenancetype', 'worktype', 'jobtype', 'category'],
  tag: ['tag', 'tagnumber', 'tagno', 'instrument', 'instrumenttag', 'instrumentnumber', 'equipment', 'asset'],
  problem: ['problem', 'issue', 'fault', 'description', 'problemstatement'],
  action: ['action', 'actiontaken', 'resolution', 'solution', 'fix', 'remedy', 'correction'],
  comments: ['comments', 'comment', 'remarks', 'remark', 'notes', 'note', 'observations', 'observation'],
} as const

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function normalizeColumnKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeDate(value: unknown) {
  return parseImportedDate(value)
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
    if (row[alias] !== undefined) {
      return row[alias]
    }
  }

  return ''
}

function applyMergedCellValues(rows: unknown[][], merges: MergeRange[]) {
  merges.forEach(({ s, e }) => {
    const mergedValue = rows[s.r]?.[s.c] ?? ''

    for (let rowIndex = s.r; rowIndex <= e.r; rowIndex += 1) {
      if (!rows[rowIndex]) {
        rows[rowIndex] = []
      }

      for (let columnIndex = s.c; columnIndex <= e.c; columnIndex += 1) {
        rows[rowIndex][columnIndex] = mergedValue
      }
    }
  })
}

function isCompletelyEmptyRow(row: ParsedWorksheetRow) {
  return Object.values(row).every((value) => normalizeText(value) === '')
}

function getWorksheetDisplayRows(
  worksheet: Record<string, unknown>,
  XLSX: Awaited<typeof import('xlsx')>
) {
  const reference = typeof worksheet['!ref'] === 'string' ? worksheet['!ref'] : 'A1:A1'
  const range = XLSX.utils.decode_range(reference)
  const rows: unknown[][] = []

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: unknown[] = []

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
      const cell = worksheet[address] as { w?: unknown; v?: unknown } | undefined
      row.push(cell?.w ?? cell?.v ?? '')
    }

    rows.push(row)
  }

  return rows
}

export const ExcelImport: React.FC<ExcelImportProps> = ({
  onImportSuccess,
  onImportError,
  isLoading = false,
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
      const workbook = XLSX.read(workbookData, { type: 'array', cellDates: false })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = getWorksheetDisplayRows(worksheet as Record<string, unknown>, XLSX)

      if (rawRows.length <= 1) {
        onImportError('Excel file is empty or has no data rows.')
        return
      }

      applyMergedCellValues(rawRows, (worksheet['!merges'] as MergeRange[] | undefined) || [])

      const [headerRow, ...dataRows] = rawRows
      const normalizedHeaders = (headerRow || []).map((header) => normalizeColumnKey(header))
      const activities: Activity[] = []
      const errorRows: string[] = []

      dataRows.forEach((row) => {
        if (!Array.isArray(row)) {
          return
        }

        const normalizedRow = normalizedHeaders.reduce<ParsedWorksheetRow>((accumulator, header, columnIndex) => {
          if (header) {
            accumulator[header] = row[columnIndex]
          }
          return accumulator
        }, {})

        if (isCompletelyEmptyRow(normalizedRow)) {
          return
        }

        const rawActivityType = normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.activityType))
        const activityType = normalizeImportedActivityType(rawActivityType)

        if (rawActivityType && !activityType) {
          errorRows.push(
            `Invalid activity type "${rawActivityType}" for ${
              normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.date)) || 'Empty date'
            } / ${normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.tag)) || 'Empty tag'}`
          )
          return
        }

        activities.push({
          date: normalizeDate(getRowValue(normalizedRow, COLUMN_ALIASES.date)),
          performer: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.performer)),
          system: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.system)),
          activityType,
          tag: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.tag)),
          problem: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.problem)),
          action: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.action)),
          comments: normalizeText(getRowValue(normalizedRow, COLUMN_ALIASES.comments)),
        })
      })

      if (activities.length === 0) {
        onImportError(
          errorRows.length > 0
            ? `Import failed. ${errorRows.slice(0, 3).join(' ')}`
            : 'Excel file is empty or has no activity rows to import.'
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
            successCount += 1
          } catch (rowError) {
            errorRows.push(
              `${activity.date || 'Empty date'} / ${activity.tag || 'Empty tag'}: ${
                rowError instanceof Error ? rowError.message : 'Unknown error'
              }`
            )
          } finally {
            processedCount += 1
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
          Upload an Excel file to bulk import activities. Merged cells are carried down to all rows inside
          the merged range.
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
                <th>Activity Type</th>
                <th>System</th>
                <th>Tag</th>
                <th>Problem</th>
                <th>Action</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>3-Apr-2026</td>
                <td>Ahmed Mohamed</td>
                <td>PM</td>
                <td>DCS</td>
                <td>920TT305</td>
                <td>Add H Alarm</td>
                <td>Added H Alarm at 100C</td>
                <td>Now Normal</td>
              </tr>
              <tr>
                <td>4-3-26</td>
                <td></td>
                <td>CM</td>
                <td>LCS</td>
                <td>LCS Alarm</td>
                <td>CH1 S 7R Fault</td>
                <td>Checked communication card</td>
                <td></td>
              </tr>
              <tr>
                <td>03/04/2026</td>
                <td></td>
                <td>CM</td>
                <td>DCS</td>
                <td>920TT305</td>
                <td>Reading error</td>
                <td>Checked transmitter</td>
                <td></td>
              </tr>
              <tr>
                <td>04-03-2026</td>
                <td>Sara Ali</td>
                <td>Mod</td>
                <td>PLC</td>
                <td>200FIC310</td>
                <td>Valve response delay</td>
                <td>Tuning was made</td>
                <td>Monitor next shift</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
