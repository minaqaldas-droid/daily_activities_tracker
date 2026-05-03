import React, { useEffect, useMemo, useState } from 'react'
import { getReusableEditorCatalogs, type Settings, type Team, type User, updateSettings, uploadBrandingAsset } from '../supabaseClient'
import {
  getActivityFieldConfig,
  getOrderedActivityFields,
  normalizeFieldKey,
  normalizeStoredActivityFieldDefinitions,
  type ActivityFieldConfig,
  type StoredActivityFieldDefinition,
} from '../utils/activityFields'
import {
  getDashboardCardConfig,
  getOrderedDashboardCards,
  normalizeStoredDashboardCardDefinitions,
  type DashboardCardConfig,
  type DashboardCardMetric,
  type StoredDashboardCardDefinition,
} from '../utils/dashboardCards'
import {
  getDashboardChartConfig,
  getDefaultDashboardChartLabelForField,
  getOrderedDashboardCharts,
  normalizeStoredDashboardChartDefinitions,
  type DashboardChartConfig,
  type StoredDashboardChartDefinition,
} from '../utils/dashboardCharts'
import { getLayoutConfig, type LayoutConfig } from '../utils/layoutConfig'

interface AdminPanelProps {
  user: User
  activeTeam?: Team | null
  currentSettings: Settings
  onClose: () => void
  onSettingsUpdate: (settings: Settings) => void
  onOpenUserManagement: () => void
  isLoading?: boolean
}

type EditorView = 'fields' | 'charts' | 'cards' | null

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const CORE_CHART_KEYS = new Set(['activityType', 'performer', 'system', 'shift', 'instrumentType', 'topTags'])
const CORE_CARD_KEYS = new Set(['totalActivities', 'myActivities', 'thisWeekActivities', 'recentlyEdited'])
const DEFAULT_CARD_ICON = '*'
const CHART_ITEM_LIMIT_OPTIONS = [4, 6, 8, 10, 20, 30, 50, 100]

function isValidImageFile(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE
}

function normalizeSequentialFieldOrder(settings: Settings, fieldDefinitions: StoredActivityFieldDefinition[], fieldConfig: ActivityFieldConfig) {
  const orderedFields = getOrderedActivityFields({
    ...settings,
    activity_field_definitions: fieldDefinitions,
    activity_field_config: fieldConfig,
  })

  return orderedFields.reduce<ActivityFieldConfig>((accumulator, field, index) => {
    accumulator[field.key] = {
      ...fieldConfig[field.key],
      enabled: fieldConfig[field.key]?.enabled ?? field.defaultEnabled,
      required: fieldConfig[field.key]?.required ?? field.defaultRequired,
      order: index + 1,
    }
    return accumulator
  }, { ...fieldConfig })
}

function normalizeSequentialChartOrder(settings: Settings, chartDefinitions: StoredDashboardChartDefinition[], chartConfig: DashboardChartConfig) {
  const orderedCharts = getOrderedDashboardCharts({
    ...settings,
    dashboard_chart_definitions: chartDefinitions,
    dashboard_chart_config: chartConfig,
  })

  return orderedCharts.reduce<DashboardChartConfig>((accumulator, chart, index) => {
    accumulator[chart.key] = {
      ...chartConfig[chart.key],
      enabled: chartConfig[chart.key]?.enabled ?? chart.enabled,
      order: index + 1,
    }
    return accumulator
  }, { ...chartConfig })
}

function normalizeSequentialCardOrder(settings: Settings, cardDefinitions: StoredDashboardCardDefinition[], cardConfig: DashboardCardConfig) {
  const orderedCards = getOrderedDashboardCards({
    ...settings,
    dashboard_card_definitions: cardDefinitions,
    dashboard_card_config: cardConfig,
  })

  return orderedCards.reduce<DashboardCardConfig>((accumulator, card, index) => {
    accumulator[card.key] = {
      ...cardConfig[card.key],
      enabled: cardConfig[card.key]?.enabled ?? card.enabled,
      order: index + 1,
    }
    return accumulator
  }, { ...cardConfig })
}

function deriveMocActivityVisibility(fieldDefinitions: StoredActivityFieldDefinition[], fieldConfig: ActivityFieldConfig) {
  const mocDefinition = fieldDefinitions.find((field) => field.key === 'mocActivity')
  if (mocDefinition?.archived) {
    return false
  }

  return fieldConfig.mocActivity?.enabled ?? true
}

function restoreByKey<T extends { key: string }>(items: T[], nextItem: T) {
  const existingIndex = items.findIndex((item) => item.key === nextItem.key)
  if (existingIndex === -1) {
    return [...items, nextItem]
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item))
}

function upsertByKey<T extends { key: string }>(items: T[], key: string, nextItem: T) {
  const hasExisting = items.some((item) => item.key === key)
  if (!hasExisting) {
    return [...items, nextItem]
  }

  return items.map((item) => (item.key === key ? nextItem : item))
}

function getMetricLabel(metric: DashboardCardMetric) {
  switch (metric) {
    case 'totalActivities':
      return 'Total Activities'
    case 'myActivities':
      return 'Your Activities'
    case 'thisWeekActivities':
      return 'This Week Activities'
    case 'recentlyEditedCount':
      return 'Recently Edited'
    case 'fieldValueCount':
      return 'Field Value Count'
    case 'fieldHasValueCount':
      return 'Field Has Value Count'
    default:
      return metric
  }
}

function EditorModal({
  title,
  description,
  stats,
  onClose,
  onApply,
  isBusy,
  children,
}: {
  title: string
  description: string
  stats?: React.ReactNode
  onClose: () => void
  onApply: () => void
  isBusy: boolean
  children: React.ReactNode
}) {
  return (
    <div className="modal-overlay">
      <div className="settings-modal admin-settings-modal admin-editor-modal">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p className="form-hint admin-editor-header-copy">{description}</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {stats ? <div className="admin-editor-stats">{stats}</div> : null}

        <div className="admin-editor-shell">{children}</div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onApply} disabled={isBusy}>
            Save Changes
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-summary-chip">
      <span className="admin-summary-chip-label">{label}</span>
      <strong className="admin-summary-chip-value">{value}</strong>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="admin-section-card">
      <div className="admin-section-card-header">
        <h3>{title}</h3>
        {description ? <p className="form-hint">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function EditorLaunchCard({
  title,
  description,
  countLabel,
  countValue,
  onOpen,
  isBusy,
}: {
  title: string
  description: string
  countLabel: string
  countValue: number
  onOpen: () => void
  isBusy: boolean
}) {
  return (
    <div className="editor-launch-card">
      <div className="editor-launch-card-copy">
        <strong>{title}</strong>
        <p className="form-hint">{description}</p>
      </div>
      <SummaryChip label={countLabel} value={countValue} />
      <button type="button" className="btn btn-primary" onClick={onOpen} disabled={isBusy}>
        Open Editor
      </button>
    </div>
  )
}

function FieldsEditor({
  currentSettings,
  fieldDefinitions,
  fieldConfig,
  reusableFieldOptions,
  showMocActivity,
  onShowMocActivityChange,
  onApply,
  onCancel,
  isBusy,
}: {
  currentSettings: Settings
  fieldDefinitions: StoredActivityFieldDefinition[]
  fieldConfig: ActivityFieldConfig
  reusableFieldOptions: StoredActivityFieldDefinition[]
  showMocActivity: boolean
  onShowMocActivityChange: (value: boolean) => void
  onApply: (definitions: StoredActivityFieldDefinition[], config: ActivityFieldConfig) => void
  onCancel: () => void
  isBusy: boolean
}) {
  const [draftDefinitions, setDraftDefinitions] = useState<StoredActivityFieldDefinition[]>(fieldDefinitions)
  const [draftConfig, setDraftConfig] = useState<ActivityFieldConfig>(fieldConfig)
  const [newField, setNewField] = useState<StoredActivityFieldDefinition>({
    key: '',
    label: '',
    placeholder: '',
    type: 'text',
    options: [],
    searchable: true,
    tableBadge: false,
  })
  const [newFieldEnabled, setNewFieldEnabled] = useState(true)
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [selectedReusableFieldKey, setSelectedReusableFieldKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDraftDefinitions(fieldDefinitions)
    setDraftConfig(fieldConfig)
  }, [fieldConfig, fieldDefinitions])

  const effectiveSettings = useMemo(
    () => ({
      ...currentSettings,
      activity_field_definitions: draftDefinitions,
      activity_field_config: draftConfig,
    }),
    [currentSettings, draftConfig, draftDefinitions]
  )
  const orderedFields = getOrderedActivityFields(effectiveSettings)
  const customCount = orderedFields.filter((field) => field.isCustom).length
  const reusableFields = useMemo(
    () => reusableFieldOptions.filter((option) => !orderedFields.some((field) => field.key === option.key)),
    [orderedFields, reusableFieldOptions]
  )

  useEffect(() => {
    if (!reusableFields.some((field) => field.key === selectedReusableFieldKey)) {
      setSelectedReusableFieldKey(reusableFields[0]?.key || '')
    }
  }, [reusableFields, selectedReusableFieldKey])

  const moveField = (fieldKey: string, direction: -1 | 1) => {
    const currentIndex = orderedFields.findIndex((field) => field.key === fieldKey)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedFields.length) {
      return
    }

    const currentField = orderedFields[currentIndex]
    const targetField = orderedFields[targetIndex]
    const currentOrder = draftConfig[currentField.key]?.order ?? currentField.defaultOrder
    const targetOrder = draftConfig[targetField.key]?.order ?? targetField.defaultOrder

    setDraftConfig((previous) => ({
      ...previous,
      [currentField.key]: {
        ...previous[currentField.key],
        enabled: previous[currentField.key]?.enabled ?? currentField.defaultEnabled,
        required: previous[currentField.key]?.required ?? currentField.defaultRequired,
        order: targetOrder,
      },
      [targetField.key]: {
        ...previous[targetField.key],
        enabled: previous[targetField.key]?.enabled ?? targetField.defaultEnabled,
        required: previous[targetField.key]?.required ?? targetField.defaultRequired,
        order: currentOrder,
      },
    }))
  }

  const getNextFieldOrder = () =>
    orderedFields.reduce((highestOrder, field) => Math.max(highestOrder, draftConfig[field.key]?.order ?? field.defaultOrder), 0) + 1

  const updateStoredField = (fieldKey: string, nextDefinition: StoredActivityFieldDefinition) => {
    setDraftDefinitions((previous) => upsertByKey(previous, fieldKey, nextDefinition))
  }

  const deleteField = (fieldKey: string) => {
    const current = orderedFields.find((field) => field.key === fieldKey)
    if (!current) {
      return
    }

    updateStoredField(fieldKey, {
      key: fieldKey,
      label: current.label,
      placeholder: current.placeholder,
      type: current.type,
      options: current.options,
      searchable: current.searchable,
      tableBadge: current.tableBadge,
      archived: true,
    })
    setDraftConfig((previous) => ({
      ...previous,
      [fieldKey]: {
        enabled: false,
        required: false,
        order: previous[fieldKey]?.order ?? 999,
      },
    }))
  }

  const addField = () => {
    const label = newField.label.trim()
    if (!label) {
      setError('Field label is required.')
      return
    }

    const key = normalizeFieldKey(newField.key || label)
    if (draftDefinitions.some((field) => field.key === key)) {
      setError('Field key already exists.')
      return
    }

    const definition: StoredActivityFieldDefinition = {
      key,
      label,
      placeholder: newField.placeholder?.trim() || `Enter ${label.toLowerCase()}`,
      type: newField.type,
      options: newField.type === 'select' ? newFieldOptions.split(',').map((item) => item.trim()).filter(Boolean) : [],
      searchable: newField.searchable !== false,
      tableBadge: Boolean(newField.tableBadge),
      archived: false,
    }

    setDraftDefinitions((previous) => [...previous, definition])
    setDraftConfig((previous) => ({
      ...previous,
      [key]: {
        enabled: newFieldEnabled,
        required: newFieldEnabled ? newFieldRequired : false,
        order: getNextFieldOrder(),
      },
    }))
    setNewField({
      key: '',
      label: '',
      placeholder: '',
      type: 'text',
      options: [],
      searchable: true,
      tableBadge: false,
    })
    setNewFieldEnabled(true)
    setNewFieldRequired(false)
    setNewFieldOptions('')
    setError('')
  }

  const addReusableField = () => {
    if (!selectedReusableFieldKey) {
      setError('Select a reusable field first.')
      return
    }

    const reusableField = reusableFields.find((field) => field.key === selectedReusableFieldKey)
    if (!reusableField) {
      setError('Selected reusable field is no longer available.')
      return
    }

    setDraftDefinitions((previous) =>
      restoreByKey(previous, {
        ...reusableField,
        archived: false,
      })
    )
    setDraftConfig((previous) => ({
      ...previous,
      [reusableField.key]: {
        enabled: true,
        required: false,
        order: getNextFieldOrder(),
      },
    }))
    if (reusableField.key === 'mocActivity') {
      onShowMocActivityChange(true)
    }
    setError('')
  }

  return (
    <EditorModal
      title="Team Activity Fields Editor"
      description="Manage which activity fields appear in add, edit, search, and results views for this team."
      stats={
        <>
          <SummaryChip label="Total Fields" value={orderedFields.length} />
          <SummaryChip label="Custom Fields" value={customCount} />
          <SummaryChip label="Visible Fields" value={orderedFields.filter((field) => draftConfig[field.key]?.enabled ?? field.defaultEnabled).length} />
        </>
      }
      onClose={onCancel}
      onApply={() => onApply(draftDefinitions, normalizeSequentialFieldOrder(currentSettings, draftDefinitions, draftConfig))}
      isBusy={isBusy}
    >
      <div className="admin-editor-main">
        <div className="admin-editor-list">
          {error ? <div className="error-message">{error}</div> : null}
          {orderedFields.map((field, index) => {
            const storedDefinition = draftDefinitions.find((item) => item.key === field.key)
            const isEnabled = draftConfig[field.key]?.enabled ?? field.defaultEnabled
            const isRequired = draftConfig[field.key]?.required ?? field.defaultRequired

            return (
              <article key={field.key} className="admin-entity-card">
                <div className="admin-entity-card-header">
                  <div>
                    <h4>{field.label}</h4>
                    <p className="form-hint">
                      {field.isCustom ? 'Custom field' : 'Legacy field'} . Key: <code>{field.key}</code>
                    </p>
                  </div>
                  <div className="admin-entity-order-badge">#{index + 1}</div>
                </div>

                <div className="form-row form-row-two-up">
                  <div className="form-group">
                    <label>Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: event.target.value,
                          placeholder: field.placeholder,
                          type: field.type,
                          options: field.options,
                          searchable: field.searchable,
                          tableBadge: field.tableBadge,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    />
                  </div>
                  <div className="form-group">
                    <label>Field Type</label>
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: storedDefinition?.label || field.label,
                          placeholder: field.placeholder,
                          type: event.target.value as StoredActivityFieldDefinition['type'],
                          options: field.options,
                          searchable: field.searchable,
                          tableBadge: field.tableBadge,
                          archived: false,
                        })
                      }
                      disabled={isBusy || field.key === 'mocActivity' || field.key === 'performer'}
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-two-up">
                  <div className="form-group">
                    <label>Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: storedDefinition?.label || field.label,
                          placeholder: event.target.value,
                          type: field.type,
                          options: field.options,
                          searchable: field.searchable,
                          tableBadge: field.tableBadge,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    />
                  </div>
                  <div className="form-group">
                    <label>Field Key</label>
                    <input type="text" value={field.key} readOnly disabled />
                  </div>
                </div>

                {field.type === 'select' ? (
                  <div className="form-group">
                    <label>Options</label>
                    <input
                      type="text"
                      value={(field.options || []).join(', ')}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: storedDefinition?.label || field.label,
                          placeholder: field.placeholder,
                          type: field.type,
                          options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                          searchable: field.searchable,
                          tableBadge: field.tableBadge,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    />
                  </div>
                ) : null}

                <div className="admin-inline-toggle-grid">
                  <label className="admin-inline-toggle">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(event) =>
                        setDraftConfig((previous) => ({
                          ...previous,
                          [field.key]: {
                            enabled: event.target.checked,
                            required: event.target.checked ? previous[field.key]?.required ?? field.defaultRequired : false,
                            order: previous[field.key]?.order ?? index + 1,
                          },
                        }))
                      }
                      disabled={isBusy}
                    />
                    <span>Available in UI</span>
                  </label>
                  <label className="admin-inline-toggle">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(event) =>
                        setDraftConfig((previous) => ({
                          ...previous,
                          [field.key]: {
                            enabled: previous[field.key]?.enabled ?? field.defaultEnabled,
                            required: event.target.checked,
                            order: previous[field.key]?.order ?? index + 1,
                          },
                        }))
                      }
                      disabled={isBusy || !isEnabled}
                    />
                    <span>Required</span>
                  </label>
                  <label className="admin-inline-toggle">
                    <input
                      type="checkbox"
                      checked={field.searchable !== false}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: storedDefinition?.label || field.label,
                          placeholder: field.placeholder,
                          type: field.type,
                          options: field.options,
                          searchable: event.target.checked,
                          tableBadge: field.tableBadge,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    />
                    <span>Searchable</span>
                  </label>
                  <label className="admin-inline-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(field.tableBadge)}
                      onChange={(event) =>
                        updateStoredField(field.key, {
                          key: field.key,
                          label: storedDefinition?.label || field.label,
                          placeholder: field.placeholder,
                          type: field.type,
                          options: field.options,
                          searchable: field.searchable,
                          tableBadge: event.target.checked,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    />
                    <span>Badge style in table</span>
                  </label>
                </div>

                <div className="admin-entity-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => moveField(field.key, -1)} disabled={isBusy || index === 0}>
                    Move Up
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => moveField(field.key, 1)} disabled={isBusy || index === orderedFields.length - 1}>
                    Move Down
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => deleteField(field.key)} disabled={isBusy}>
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        <aside className="admin-editor-sidebar">
          <SectionCard title="Reuse Existing Field" description="Choose any field already created in another team or from the shared starter library, then add it to this team.">
            <div className="form-group">
              <label>Available Fields</label>
              <select value={selectedReusableFieldKey} onChange={(event) => setSelectedReusableFieldKey(event.target.value)} disabled={isBusy || reusableFields.length === 0}>
                {reusableFields.length === 0 ? <option value="">No reusable fields available</option> : null}
                {reusableFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} ({field.key})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" onClick={addReusableField} disabled={isBusy || reusableFields.length === 0}>
              Add Selected Field
            </button>
          </SectionCard>

          <SectionCard title="Add New Field" description="Create a new field and make it immediately available across add, edit, search, and results screens.">
            <div className="form-group">
              <label>Label</label>
              <input
                type="text"
                value={newField.label || ''}
                onChange={(event) => setNewField((previous) => ({ ...previous, label: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Key</label>
              <input
                type="text"
                value={newField.key || ''}
                onChange={(event) => setNewField((previous) => ({ ...previous, key: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Field Type</label>
              <select
                value={newField.type}
                onChange={(event) => setNewField((previous) => ({ ...previous, type: event.target.value as StoredActivityFieldDefinition['type'] }))}
                disabled={isBusy}
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="select">Select</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            <div className="form-group">
              <label>Placeholder</label>
              <input
                type="text"
                value={newField.placeholder || ''}
                onChange={(event) => setNewField((previous) => ({ ...previous, placeholder: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            {newField.type === 'select' ? (
              <div className="form-group">
                <label>Options</label>
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(event) => setNewFieldOptions(event.target.value)}
                  placeholder="Comma separated options"
                  disabled={isBusy}
                />
              </div>
            ) : null}
            <div className="admin-inline-toggle-grid">
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={newFieldEnabled}
                  onChange={(event) => setNewFieldEnabled(event.target.checked)}
                  disabled={isBusy}
                />
                <span>Available in UI</span>
              </label>
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(event) => setNewFieldRequired(event.target.checked)}
                  disabled={isBusy || !newFieldEnabled}
                />
                <span>Required</span>
              </label>
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={newField.searchable !== false}
                  onChange={(event) => setNewField((previous) => ({ ...previous, searchable: event.target.checked }))}
                  disabled={isBusy}
                />
                <span>Searchable</span>
              </label>
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(newField.tableBadge)}
                  onChange={(event) => setNewField((previous) => ({ ...previous, tableBadge: event.target.checked }))}
                  disabled={isBusy}
                />
                <span>Badge style in table</span>
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={addField} disabled={isBusy}>
              Add Field
            </button>
          </SectionCard>
        </aside>
      </div>
    </EditorModal>
  )
}

function ChartsEditor({
  currentSettings,
  fieldDefinitions,
  fieldConfig,
  chartDefinitions,
  chartConfig,
  reusableChartOptions,
  onApply,
  onCancel,
  isBusy,
}: {
  currentSettings: Settings
  fieldDefinitions: StoredActivityFieldDefinition[]
  fieldConfig: ActivityFieldConfig
  chartDefinitions: StoredDashboardChartDefinition[]
  chartConfig: DashboardChartConfig
  reusableChartOptions: StoredDashboardChartDefinition[]
  onApply: (definitions: StoredDashboardChartDefinition[], config: DashboardChartConfig) => void
  onCancel: () => void
  isBusy: boolean
}) {
  const [draftDefinitions, setDraftDefinitions] = useState<StoredDashboardChartDefinition[]>(chartDefinitions)
  const [draftConfig, setDraftConfig] = useState<DashboardChartConfig>(chartConfig)
  const [newChart, setNewChart] = useState<StoredDashboardChartDefinition>({
    key: '',
    label: '',
    fieldKey: 'tag',
    chartType: 'bar',
    maxItems: 6,
    includeEmpty: false,
  })
  const [newChartVisible, setNewChartVisible] = useState(true)
  const [selectedReusableChartKey, setSelectedReusableChartKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDraftDefinitions(chartDefinitions)
    setDraftConfig(chartConfig)
  }, [chartConfig, chartDefinitions])

  const effectiveSettings = useMemo(
    () => ({
      ...currentSettings,
      activity_field_definitions: fieldDefinitions,
      activity_field_config: fieldConfig,
      dashboard_chart_definitions: draftDefinitions,
      dashboard_chart_config: draftConfig,
    }),
    [chartConfig, currentSettings, draftConfig, draftDefinitions, fieldConfig, fieldDefinitions]
  )
  const orderedFields = getOrderedActivityFields(effectiveSettings)
  const orderedCharts = useMemo(
    () =>
      normalizeStoredDashboardChartDefinitions(draftDefinitions, effectiveSettings)
        .filter((chart) => !chart.archived)
        .map((chart, index) => ({
          key: chart.key,
          label: chart.label,
          fieldKey: chart.fieldKey,
          chartType: chart.chartType,
          maxItems: chart.maxItems,
          includeEmpty: chart.includeEmpty,
          enabled: draftConfig[chart.key]?.enabled ?? true,
          order: draftConfig[chart.key]?.order ?? index + 1,
        }))
        .sort((first, second) => {
          if (first.order !== second.order) {
            return first.order - second.order
          }

          return first.label.localeCompare(second.label)
        }),
    [draftConfig, draftDefinitions, effectiveSettings]
  )
  const reusableCharts = useMemo(
    () => reusableChartOptions.filter((option) => !orderedCharts.some((chart) => chart.key === option.key)),
    [orderedCharts, reusableChartOptions]
  )

  useEffect(() => {
    if (!reusableCharts.some((chart) => chart.key === selectedReusableChartKey)) {
      setSelectedReusableChartKey(reusableCharts[0]?.key || '')
    }
  }, [reusableCharts, selectedReusableChartKey])

  const moveChart = (chartKey: string, direction: -1 | 1) => {
    const currentIndex = orderedCharts.findIndex((chart) => chart.key === chartKey)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedCharts.length) {
      return
    }

    const currentChart = orderedCharts[currentIndex]
    const targetChart = orderedCharts[targetIndex]

    setDraftConfig((previous) => ({
      ...previous,
      [currentChart.key]: {
        ...previous[currentChart.key],
        order: previous[targetChart.key]?.order ?? targetIndex + 1,
      },
      [targetChart.key]: {
        ...previous[targetChart.key],
        order: previous[currentChart.key]?.order ?? currentIndex + 1,
      },
    }))
  }

  const updateStoredChart = (chartKey: string, nextDefinition: StoredDashboardChartDefinition) => {
    setDraftDefinitions((previous) => upsertByKey(previous, chartKey, nextDefinition))
  }

  const deleteChart = (chartKey: string) => {
    const current = orderedCharts.find((chart) => chart.key === chartKey)
    if (!current) {
      return
    }

    updateStoredChart(chartKey, {
      key: chartKey,
      label: current.label,
      fieldKey: current.fieldKey,
      chartType: current.chartType,
      maxItems: current.maxItems,
      includeEmpty: current.includeEmpty,
      archived: true,
    })
    setDraftConfig((previous) => ({
      ...previous,
      [chartKey]: {
        enabled: false,
        order: previous[chartKey]?.order ?? 999,
      },
    }))
  }

  const addChart = () => {
    if (!newChart.fieldKey) {
      setError('Chart source field is required.')
      return
    }

    const label = newChart.label.trim() || getDefaultDashboardChartLabelForField(newChart.fieldKey)
    const key = normalizeFieldKey(newChart.key || label)
    if (draftDefinitions.some((chart) => chart.key === key)) {
      setError('Chart key already exists.')
      return
    }

    setDraftDefinitions((previous) => [
      ...previous,
      {
        key,
        label,
        fieldKey: newChart.fieldKey,
        chartType: newChart.chartType,
        maxItems: Number(newChart.maxItems || 6),
        includeEmpty: Boolean(newChart.includeEmpty),
        archived: false,
      },
    ])
    setDraftConfig((previous) => ({
      ...previous,
      [key]: {
        enabled: newChartVisible,
        order: orderedCharts.length + 1,
      },
    }))
    setNewChart({
      key: '',
      label: '',
      fieldKey: orderedFields[0]?.key || 'tag',
      chartType: 'bar',
      maxItems: 6,
      includeEmpty: false,
    })
    setNewChartVisible(true)
    setError('')
  }

  const addReusableChart = () => {
    if (!selectedReusableChartKey) {
      setError('Select a reusable chart first.')
      return
    }

    const reusableChart = reusableCharts.find((chart) => chart.key === selectedReusableChartKey)
    if (!reusableChart) {
      setError('Selected reusable chart is no longer available.')
      return
    }

    if (!orderedFields.some((field) => field.key === reusableChart.fieldKey)) {
      setError('Add the chart source field to this team before reusing this chart.')
      return
    }

    setDraftDefinitions((previous) =>
      restoreByKey(previous, {
        ...reusableChart,
        archived: false,
      })
    )
    setDraftConfig((previous) => ({
      ...previous,
      [reusableChart.key]: {
        enabled: true,
        order: orderedCharts.length + 1,
      },
    }))
    setError('')
  }

  return (
    <EditorModal
      title="Dashboard Charts Editor"
      description="Manage dashboard charts, data sources, visibility, and ordering with team-scoped database settings."
      stats={
        <>
          <SummaryChip label="Total Charts" value={orderedCharts.length} />
          <SummaryChip label="Custom Charts" value={orderedCharts.filter((chart) => !CORE_CHART_KEYS.has(chart.key)).length} />
          <SummaryChip label="Visible Charts" value={orderedCharts.filter((chart) => draftConfig[chart.key]?.enabled ?? chart.enabled).length} />
        </>
      }
      onClose={onCancel}
      onApply={() => onApply(draftDefinitions, normalizeSequentialChartOrder(currentSettings, draftDefinitions, draftConfig))}
      isBusy={isBusy}
    >
      <div className="admin-editor-main">
        <div className="admin-editor-list">
          {error ? <div className="error-message">{error}</div> : null}
          {orderedCharts.map((chart, index) => (
            <article key={chart.key} className="admin-entity-card">
              <div className="admin-entity-card-header">
                <div>
                  <h4>{chart.label}</h4>
                  <p className="form-hint">
                    {CORE_CHART_KEYS.has(chart.key) ? 'Legacy chart' : 'Custom chart'} . Key: <code>{chart.key}</code>
                  </p>
                </div>
                <div className="admin-entity-order-badge">#{index + 1}</div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Label</label>
                  <input
                    type="text"
                    value={chart.label}
                    onChange={(event) =>
                      updateStoredChart(chart.key, {
                        key: chart.key,
                        label: event.target.value,
                        fieldKey: chart.fieldKey,
                        chartType: chart.chartType,
                        maxItems: chart.maxItems,
                        includeEmpty: chart.includeEmpty,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
                <div className="form-group">
                  <label>Chart Type</label>
                  <select
                    value={chart.chartType}
                    onChange={(event) =>
                      updateStoredChart(chart.key, {
                        key: chart.key,
                        label: chart.label,
                        fieldKey: chart.fieldKey,
                        chartType: event.target.value as StoredDashboardChartDefinition['chartType'],
                        maxItems: chart.maxItems,
                        includeEmpty: chart.includeEmpty,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  >
                    <option value="bar">Bar</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Source Field</label>
                  <select
                    value={chart.fieldKey}
                    onChange={(event) =>
                      updateStoredChart(chart.key, {
                        key: chart.key,
                        label: chart.label,
                        fieldKey: event.target.value,
                        chartType: chart.chartType,
                        maxItems: chart.maxItems,
                        includeEmpty: chart.includeEmpty,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  >
                    {orderedFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Chart Key</label>
                  <input type="text" value={chart.key} readOnly disabled />
                </div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Items to Display</label>
                  <select
                    value={Number(chart.maxItems || 6)}
                    onChange={(event) =>
                      updateStoredChart(chart.key, {
                        key: chart.key,
                        label: chart.label,
                        fieldKey: chart.fieldKey,
                        chartType: chart.chartType,
                        maxItems: Number(event.target.value),
                        includeEmpty: chart.includeEmpty,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  >
                    {CHART_ITEM_LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="admin-inline-toggle admin-inline-toggle-block">
                  <input
                    type="checkbox"
                    checked={Boolean(chart.includeEmpty)}
                    onChange={(event) =>
                      updateStoredChart(chart.key, {
                        key: chart.key,
                        label: chart.label,
                        fieldKey: chart.fieldKey,
                        chartType: chart.chartType,
                        maxItems: chart.maxItems,
                        includeEmpty: event.target.checked,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  />
                  <span>Include empty values</span>
                </label>
              </div>

              <div className="admin-inline-toggle-grid">
                <label className="admin-inline-toggle">
                  <input
                    type="checkbox"
                    checked={draftConfig[chart.key]?.enabled ?? chart.enabled}
                    onChange={(event) =>
                      setDraftConfig((previous) => ({
                        ...previous,
                        [chart.key]: {
                          enabled: event.target.checked,
                          order: previous[chart.key]?.order ?? index + 1,
                        },
                      }))
                    }
                    disabled={isBusy}
                  />
                  <span>Visible on dashboard</span>
                </label>
              </div>

              <div className="admin-entity-actions">
                <button type="button" className="btn btn-secondary" onClick={() => moveChart(chart.key, -1)} disabled={isBusy || index === 0}>
                  Move Up
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => moveChart(chart.key, 1)} disabled={isBusy || index === orderedCharts.length - 1}>
                  Move Down
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => deleteChart(chart.key)} disabled={isBusy}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="admin-editor-sidebar">
          <SectionCard title="Reuse Existing Chart" description="Choose a chart already created in another team or from the shared starter library, then add it to this team.">
            <div className="form-group">
              <label>Available Charts</label>
              <select value={selectedReusableChartKey} onChange={(event) => setSelectedReusableChartKey(event.target.value)} disabled={isBusy || reusableCharts.length === 0}>
                {reusableCharts.length === 0 ? <option value="">No reusable charts available</option> : null}
                {reusableCharts.map((chart) => (
                  <option key={chart.key} value={chart.key}>
                    {chart.label} ({chart.key})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" onClick={addReusableChart} disabled={isBusy || reusableCharts.length === 0}>
              Add Selected Chart
            </button>
          </SectionCard>

          <SectionCard title="Add New Chart" description="Create a chart from any active activity field and make it instantly available on the dashboard.">
            <div className="form-group">
              <label>Label</label>
              <input
                type="text"
                value={newChart.label || ''}
                onChange={(event) => setNewChart((previous) => ({ ...previous, label: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Key</label>
              <input
                type="text"
                value={newChart.key || ''}
                onChange={(event) => setNewChart((previous) => ({ ...previous, key: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Source Field</label>
              <select
                value={newChart.fieldKey}
                onChange={(event) => setNewChart((previous) => ({ ...previous, fieldKey: event.target.value }))}
                disabled={isBusy}
              >
                {orderedFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Chart Type</label>
              <select
                value={newChart.chartType}
                onChange={(event) => setNewChart((previous) => ({ ...previous, chartType: event.target.value as StoredDashboardChartDefinition['chartType'] }))}
                disabled={isBusy}
              >
                <option value="bar">Bar</option>
                <option value="pie">Pie</option>
              </select>
            </div>
            <div className="form-group">
              <label>Items to Display</label>
              <select
                value={Number(newChart.maxItems || 6)}
                onChange={(event) => setNewChart((previous) => ({ ...previous, maxItems: Number(event.target.value) }))}
                disabled={isBusy}
              >
                {CHART_ITEM_LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-inline-toggle-grid">
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(newChart.includeEmpty)}
                  onChange={(event) => setNewChart((previous) => ({ ...previous, includeEmpty: event.target.checked }))}
                  disabled={isBusy}
                />
                <span>Include empty values</span>
              </label>
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={newChartVisible}
                  onChange={(event) => setNewChartVisible(event.target.checked)}
                  disabled={isBusy}
                />
                <span>Visible on dashboard</span>
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={addChart} disabled={isBusy}>
              Add Chart
            </button>
          </SectionCard>
        </aside>
      </div>
    </EditorModal>
  )
}

function CardsEditor({
  currentSettings,
  cardDefinitions,
  cardConfig,
  fieldSettings,
  reusableCardOptions,
  onApply,
  onCancel,
  isBusy,
}: {
  currentSettings: Settings
  cardDefinitions: StoredDashboardCardDefinition[]
  cardConfig: DashboardCardConfig
  fieldSettings: Settings
  reusableCardOptions: StoredDashboardCardDefinition[]
  onApply: (definitions: StoredDashboardCardDefinition[], config: DashboardCardConfig) => void
  onCancel: () => void
  isBusy: boolean
}) {
  const [draftDefinitions, setDraftDefinitions] = useState<StoredDashboardCardDefinition[]>(cardDefinitions)
  const [draftConfig, setDraftConfig] = useState<DashboardCardConfig>(cardConfig)
  const [newCard, setNewCard] = useState<StoredDashboardCardDefinition>({
    key: '',
    label: '',
    metric: 'totalActivities',
    icon: DEFAULT_CARD_ICON,
    description: '',
  })
  const [newCardVisible, setNewCardVisible] = useState(true)
  const [selectedReusableCardKey, setSelectedReusableCardKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDraftDefinitions(cardDefinitions)
    setDraftConfig(cardConfig)
  }, [cardConfig, cardDefinitions])

  const effectiveSettings = useMemo(
    () => ({
      ...currentSettings,
      dashboard_card_definitions: draftDefinitions,
      dashboard_card_config: draftConfig,
    }),
    [currentSettings, draftConfig, draftDefinitions]
  )
  const orderedFields = getOrderedActivityFields(fieldSettings)
  const orderedCards = getOrderedDashboardCards(effectiveSettings)
  const reusableCards = useMemo(
    () => reusableCardOptions.filter((option) => !orderedCards.some((card) => card.key === option.key)),
    [orderedCards, reusableCardOptions]
  )

  useEffect(() => {
    if (!reusableCards.some((card) => card.key === selectedReusableCardKey)) {
      setSelectedReusableCardKey(reusableCards[0]?.key || '')
    }
  }, [reusableCards, selectedReusableCardKey])

  const moveCard = (cardKey: string, direction: -1 | 1) => {
    const currentIndex = orderedCards.findIndex((card) => card.key === cardKey)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedCards.length) {
      return
    }

    const currentCard = orderedCards[currentIndex]
    const targetCard = orderedCards[targetIndex]

    setDraftConfig((previous) => ({
      ...previous,
      [currentCard.key]: {
        ...previous[currentCard.key],
        order: previous[targetCard.key]?.order ?? targetIndex + 1,
      },
      [targetCard.key]: {
        ...previous[targetCard.key],
        order: previous[currentCard.key]?.order ?? currentIndex + 1,
      },
    }))
  }

  const updateStoredCard = (cardKey: string, nextDefinition: StoredDashboardCardDefinition) => {
    setDraftDefinitions((previous) => upsertByKey(previous, cardKey, nextDefinition))
  }

  const deleteCard = (cardKey: string) => {
    const current = orderedCards.find((card) => card.key === cardKey)
    if (!current) {
      return
    }

    updateStoredCard(cardKey, {
      key: cardKey,
      label: current.label,
      metric: current.metric,
      icon: current.icon,
      fieldKey: current.fieldKey,
      fieldValue: current.fieldValue,
      description: current.description,
      archived: true,
    })
    setDraftConfig((previous) => ({
      ...previous,
      [cardKey]: {
        enabled: false,
        order: previous[cardKey]?.order ?? 999,
      },
    }))
  }

  const addCard = () => {
    const label = newCard.label.trim()
    if (!label) {
      setError('Card label is required.')
      return
    }

    if ((newCard.metric === 'fieldValueCount' || newCard.metric === 'fieldHasValueCount') && !newCard.fieldKey) {
      setError('Field-based cards need a linked field.')
      return
    }

    if (newCard.metric === 'fieldValueCount' && !String(newCard.fieldValue || '').trim()) {
      setError('Field-value cards need both a field and a value.')
      return
    }

    const key = normalizeFieldKey(newCard.key || label)
    if (draftDefinitions.some((card) => card.key === key)) {
      setError('Card key already exists.')
      return
    }

    setDraftDefinitions((previous) => [
      ...previous,
      {
        key,
        label,
        metric: newCard.metric,
        icon: newCard.icon || DEFAULT_CARD_ICON,
        fieldKey: newCard.fieldKey,
        fieldValue: newCard.fieldValue,
        description: newCard.description,
        archived: false,
      },
    ])
    setDraftConfig((previous) => ({
      ...previous,
      [key]: {
        enabled: newCardVisible,
        order: orderedCards.length + 1,
      },
    }))
    setNewCard({
      key: '',
      label: '',
      metric: 'totalActivities',
      icon: DEFAULT_CARD_ICON,
      description: '',
    })
    setNewCardVisible(true)
    setError('')
  }

  const addReusableCard = () => {
    if (!selectedReusableCardKey) {
      setError('Select a reusable card first.')
      return
    }

    const reusableCard = reusableCards.find((card) => card.key === selectedReusableCardKey)
    if (!reusableCard) {
      setError('Selected reusable card is no longer available.')
      return
    }

    if ((reusableCard.metric === 'fieldValueCount' || reusableCard.metric === 'fieldHasValueCount') && reusableCard.fieldKey && !orderedFields.some((field) => field.key === reusableCard.fieldKey)) {
      setError('Add the linked field to this team before reusing this card.')
      return
    }

    setDraftDefinitions((previous) =>
      restoreByKey(previous, {
        ...reusableCard,
        archived: false,
      })
    )
    setDraftConfig((previous) => ({
      ...previous,
      [reusableCard.key]: {
        enabled: true,
        order: orderedCards.length + 1,
      },
    }))
    setError('')
  }

  return (
    <EditorModal
      title="Dashboard Cards Editor"
      description="Manage the summary cards that sit at the top of the dashboard, including custom counters and field-value cards."
      stats={
        <>
          <SummaryChip label="Total Cards" value={orderedCards.length} />
          <SummaryChip label="Custom Cards" value={orderedCards.filter((card) => !CORE_CARD_KEYS.has(card.key)).length} />
          <SummaryChip label="Visible Cards" value={orderedCards.filter((card) => draftConfig[card.key]?.enabled ?? card.enabled).length} />
        </>
      }
      onClose={onCancel}
      onApply={() => onApply(draftDefinitions, normalizeSequentialCardOrder(currentSettings, draftDefinitions, draftConfig))}
      isBusy={isBusy}
    >
      <div className="admin-editor-main">
        <div className="admin-editor-list">
          {error ? <div className="error-message">{error}</div> : null}
          {orderedCards.map((card, index) => (
            <article key={card.key} className="admin-entity-card">
              <div className="admin-entity-card-header">
                <div>
                  <h4>{card.label}</h4>
                  <p className="form-hint">
                    {CORE_CARD_KEYS.has(card.key) ? 'Legacy card' : 'Custom card'} . Metric: {getMetricLabel(card.metric)}
                  </p>
                </div>
                <div className="admin-entity-order-badge">#{index + 1}</div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Label</label>
                  <input
                    type="text"
                    value={card.label}
                    onChange={(event) =>
                      updateStoredCard(card.key, {
                        key: card.key,
                        label: event.target.value,
                        metric: card.metric,
                        icon: card.icon,
                        fieldKey: card.fieldKey,
                        fieldValue: card.fieldValue,
                        description: card.description,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
                <div className="form-group">
                  <label>Icon / Symbol</label>
                  <input
                    type="text"
                    value={card.icon}
                    onChange={(event) =>
                      updateStoredCard(card.key, {
                        key: card.key,
                        label: card.label,
                        metric: card.metric,
                        icon: event.target.value,
                        fieldKey: card.fieldKey,
                        fieldValue: card.fieldValue,
                        description: card.description,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Metric</label>
                  <select
                    value={card.metric}
                    onChange={(event) =>
                      updateStoredCard(card.key, {
                        key: card.key,
                        label: card.label,
                        metric: event.target.value as StoredDashboardCardDefinition['metric'],
                        icon: card.icon,
                        fieldKey: card.fieldKey,
                        fieldValue: card.fieldValue,
                        description: card.description,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  >
                    <option value="totalActivities">Total Activities</option>
                    <option value="myActivities">Your Activities</option>
                    <option value="thisWeekActivities">This Week Activities</option>
                    <option value="recentlyEditedCount">Recently Edited</option>
                    <option value="fieldValueCount">Field Value Count</option>
                    <option value="fieldHasValueCount">Field Has Value Count</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Card Key</label>
                  <input type="text" value={card.key} readOnly disabled />
                </div>
              </div>

              {card.metric === 'fieldValueCount' || card.metric === 'fieldHasValueCount' ? (
                <div className="form-row form-row-two-up">
                  <div className="form-group">
                    <label>Field</label>
                    <select
                      value={card.fieldKey || ''}
                      onChange={(event) =>
                        updateStoredCard(card.key, {
                          key: card.key,
                          label: card.label,
                          metric: card.metric,
                          icon: card.icon,
                          fieldKey: event.target.value,
                          fieldValue: card.fieldValue,
                          description: card.description,
                          archived: false,
                        })
                      }
                      disabled={isBusy}
                    >
                      {orderedFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {card.metric === 'fieldValueCount' ? (
                    <div className="form-group">
                      <label>Field Value</label>
                      <input
                        type="text"
                        value={card.fieldValue || ''}
                        onChange={(event) =>
                          updateStoredCard(card.key, {
                            key: card.key,
                            label: card.label,
                            metric: card.metric,
                            icon: card.icon,
                            fieldKey: card.fieldKey,
                            fieldValue: event.target.value,
                            description: card.description,
                            archived: false,
                          })
                        }
                        disabled={isBusy}
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Field Rule</label>
                      <input type="text" value="Count activities where this field has a value" readOnly disabled />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={card.description || ''}
                    onChange={(event) =>
                      updateStoredCard(card.key, {
                        key: card.key,
                        label: card.label,
                        metric: card.metric,
                        icon: card.icon,
                        fieldKey: card.fieldKey,
                        fieldValue: card.fieldValue,
                        description: event.target.value,
                        archived: false,
                      })
                    }
                    disabled={isBusy}
                  />
                </div>
                <label className="admin-inline-toggle admin-inline-toggle-block">
                  <input
                    type="checkbox"
                    checked={draftConfig[card.key]?.enabled ?? card.enabled}
                    onChange={(event) =>
                      setDraftConfig((previous) => ({
                        ...previous,
                        [card.key]: {
                          enabled: event.target.checked,
                          order: previous[card.key]?.order ?? index + 1,
                        },
                      }))
                    }
                    disabled={isBusy}
                  />
                  <span>Visible on dashboard</span>
                </label>
              </div>

              <div className="admin-entity-actions">
                <button type="button" className="btn btn-secondary" onClick={() => moveCard(card.key, -1)} disabled={isBusy || index === 0}>
                  Move Up
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => moveCard(card.key, 1)} disabled={isBusy || index === orderedCards.length - 1}>
                  Move Down
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => deleteCard(card.key)} disabled={isBusy}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="admin-editor-sidebar">
          <SectionCard title="Reuse Existing Card" description="Choose a card already created in another team or from the shared starter library, then add it to this team.">
            <div className="form-group">
              <label>Available Cards</label>
              <select value={selectedReusableCardKey} onChange={(event) => setSelectedReusableCardKey(event.target.value)} disabled={isBusy || reusableCards.length === 0}>
                {reusableCards.length === 0 ? <option value="">No reusable cards available</option> : null}
                {reusableCards.map((card) => (
                  <option key={card.key} value={card.key}>
                    {card.label} ({card.key})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" onClick={addReusableCard} disabled={isBusy || reusableCards.length === 0}>
              Add Selected Card
            </button>
          </SectionCard>

          <SectionCard title="Add New Card" description="Create a reusable dashboard KPI card from built-in metrics or a custom field-value match.">
            <div className="form-group">
              <label>Label</label>
              <input
                type="text"
                value={newCard.label || ''}
                onChange={(event) => setNewCard((previous) => ({ ...previous, label: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Key</label>
              <input
                type="text"
                value={newCard.key || ''}
                onChange={(event) => setNewCard((previous) => ({ ...previous, key: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="form-group">
              <label>Metric</label>
              <select
                value={newCard.metric}
                onChange={(event) => setNewCard((previous) => ({ ...previous, metric: event.target.value as StoredDashboardCardDefinition['metric'] }))}
                disabled={isBusy}
              >
                <option value="totalActivities">Total Activities</option>
                <option value="myActivities">Your Activities</option>
                <option value="thisWeekActivities">This Week Activities</option>
                <option value="recentlyEditedCount">Recently Edited</option>
                <option value="fieldValueCount">Field Value Count</option>
                <option value="fieldHasValueCount">Field Has Value Count</option>
              </select>
            </div>
            <div className="form-group">
              <label>Icon / Symbol</label>
              <input
                type="text"
                value={newCard.icon || ''}
                onChange={(event) => setNewCard((previous) => ({ ...previous, icon: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            {newCard.metric === 'fieldValueCount' || newCard.metric === 'fieldHasValueCount' ? (
              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>Field</label>
                  <select
                    value={newCard.fieldKey || ''}
                    onChange={(event) => setNewCard((previous) => ({ ...previous, fieldKey: event.target.value }))}
                    disabled={isBusy}
                  >
                    {orderedFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
                {newCard.metric === 'fieldValueCount' ? (
                  <div className="form-group">
                    <label>Field Value</label>
                    <input
                      type="text"
                      value={newCard.fieldValue || ''}
                      onChange={(event) => setNewCard((previous) => ({ ...previous, fieldValue: event.target.value }))}
                      disabled={isBusy}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Field Rule</label>
                    <input type="text" value="Count activities where this field has a value" readOnly disabled />
                  </div>
                )}
              </div>
            ) : null}
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={newCard.description || ''}
                onChange={(event) => setNewCard((previous) => ({ ...previous, description: event.target.value }))}
                disabled={isBusy}
              />
            </div>
            <div className="admin-inline-toggle-grid">
              <label className="admin-inline-toggle">
                <input
                  type="checkbox"
                  checked={newCardVisible}
                  onChange={(event) => setNewCardVisible(event.target.checked)}
                  disabled={isBusy}
                />
                <span>Visible on dashboard</span>
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={addCard} disabled={isBusy}>
              Add Card
            </button>
          </SectionCard>
        </aside>
      </div>
    </EditorModal>
  )
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  activeTeam,
  currentSettings,
  onClose,
  onSettingsUpdate,
  onOpenUserManagement,
  isLoading = false,
}) => {
  const [webappName, setWebappName] = useState('')
  const [browserTabName, setBrowserTabName] = useState('')
  const [performerMode, setPerformerMode] = useState<'manual' | 'auto'>('manual')
  const [showMocActivity, setShowMocActivity] = useState(true)
  const [headerFontFamily, setHeaderFontFamily] = useState('')
  const [subheaderFontFamily, setSubheaderFontFamily] = useState('')
  const [sidebarFontFamily, setSidebarFontFamily] = useState('')
  const [fieldDefinitions, setFieldDefinitions] = useState<StoredActivityFieldDefinition[]>([])
  const [fieldConfig, setFieldConfig] = useState<ActivityFieldConfig>({})
  const [chartDefinitions, setChartDefinitions] = useState<StoredDashboardChartDefinition[]>([])
  const [chartConfig, setChartConfig] = useState<DashboardChartConfig>({})
  const [cardDefinitions, setCardDefinitions] = useState<StoredDashboardCardDefinition[]>([])
  const [cardConfig, setCardConfig] = useState<DashboardCardConfig>({})
  const [reusableFieldOptions, setReusableFieldOptions] = useState<StoredActivityFieldDefinition[]>([])
  const [reusableChartOptions, setReusableChartOptions] = useState<StoredDashboardChartDefinition[]>([])
  const [reusableCardOptions, setReusableCardOptions] = useState<StoredDashboardCardDefinition[]>([])
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(getLayoutConfig(currentSettings))
  const [logoPreview, setLogoPreview] = useState('')
  const [faviconPreview, setFaviconPreview] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeEditor, setActiveEditor] = useState<EditorView>(null)

  const canManageSettings = user.is_superadmin || user.role === 'admin'

  useEffect(() => {
    const nextFieldDefinitions = normalizeStoredActivityFieldDefinitions(currentSettings.activity_field_definitions)
    const nextFieldConfig = normalizeSequentialFieldOrder(
      currentSettings,
      nextFieldDefinitions,
      getActivityFieldConfig({ ...currentSettings, activity_field_definitions: nextFieldDefinitions })
    )
    const nextChartDefinitions = normalizeStoredDashboardChartDefinitions(currentSettings.dashboard_chart_definitions, {
      ...currentSettings,
      activity_field_definitions: nextFieldDefinitions,
      activity_field_config: nextFieldConfig,
    })
    const nextChartConfig = normalizeSequentialChartOrder(
      { ...currentSettings, activity_field_definitions: nextFieldDefinitions, activity_field_config: nextFieldConfig },
      nextChartDefinitions,
      getDashboardChartConfig({
        ...currentSettings,
        activity_field_definitions: nextFieldDefinitions,
        activity_field_config: nextFieldConfig,
        dashboard_chart_definitions: nextChartDefinitions,
      })
    )
    const nextCardDefinitions = normalizeStoredDashboardCardDefinitions(currentSettings.dashboard_card_definitions)
    const nextCardConfig = normalizeSequentialCardOrder(
      { ...currentSettings, dashboard_card_definitions: nextCardDefinitions },
      nextCardDefinitions,
      getDashboardCardConfig({
        ...currentSettings,
        dashboard_card_definitions: nextCardDefinitions,
      })
    )

    setWebappName(currentSettings.webapp_name || 'Daily Activities Tracker')
    setBrowserTabName(currentSettings.browser_tab_name || currentSettings.webapp_name || 'Daily Activities Tracker')
    setPerformerMode(currentSettings.performer_mode || 'manual')
    setShowMocActivity(currentSettings.show_moc_activity !== false)
    setHeaderFontFamily(currentSettings.header_font_family || '')
    setSubheaderFontFamily(currentSettings.subheader_font_family || '')
    setSidebarFontFamily(currentSettings.sidebar_font_family || '')
    setFieldDefinitions(nextFieldDefinitions)
    setFieldConfig(nextFieldConfig)
    setChartDefinitions(nextChartDefinitions)
    setChartConfig(nextChartConfig)
    setCardDefinitions(nextCardDefinitions)
    setCardConfig(nextCardConfig)
    setLayoutConfig(getLayoutConfig(currentSettings))
    setLogoPreview(currentSettings.logo_url || '')
    setFaviconPreview(currentSettings.favicon_url || currentSettings.logo_url || '')
    setLogoFile(null)
    setFaviconFile(null)
    setActiveEditor(null)
  }, [currentSettings])

  useEffect(() => {
    if (!activeEditor || typeof window === 'undefined') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setActiveEditor(null)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeEditor])

  useEffect(() => {
    if (!canManageSettings) {
      setReusableFieldOptions([])
      setReusableChartOptions([])
      setReusableCardOptions([])
      return
    }

    let isCancelled = false

    void getReusableEditorCatalogs()
      .then((catalogs) => {
        if (isCancelled) {
          return
        }

        setReusableFieldOptions(catalogs.fields)
        setReusableChartOptions(catalogs.charts)
        setReusableCardOptions(catalogs.cards)
      })
      .catch((catalogError) => {
        if (isCancelled) {
          return
        }

        console.error('Failed to load reusable editor catalogs:', catalogError)
      })

    return () => {
      isCancelled = true
    }
  }, [canManageSettings, currentSettings])

  const effectiveSettings = useMemo(
    () => ({
      ...currentSettings,
      activity_field_definitions: fieldDefinitions,
      activity_field_config: fieldConfig,
      dashboard_chart_definitions: chartDefinitions,
      dashboard_chart_config: chartConfig,
      dashboard_card_definitions: cardDefinitions,
      dashboard_card_config: cardConfig,
      layout_config: layoutConfig,
    }),
    [cardConfig, cardDefinitions, chartConfig, chartDefinitions, currentSettings, fieldConfig, fieldDefinitions, layoutConfig]
  )

  const orderedFields = getOrderedActivityFields(effectiveSettings)
  const orderedCharts = getOrderedDashboardCharts(effectiveSettings)
  const orderedCards = getOrderedDashboardCards(effectiveSettings)

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!isValidImageFile(file)) {
      setError('Logo must be PNG, JPG, SVG, or WebP and under 5MB.')
      return
    }

    setError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleFaviconSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!isValidImageFile(file)) {
      setError('Favicon must be PNG, JPG, SVG, or WebP and under 5MB.')
      return
    }

    setError('')
    setFaviconFile(file)
    setFaviconPreview(URL.createObjectURL(file))
  }

  const persistSettingsDraft = async (
    overrides: Partial<Settings>,
    options: {
      successMessage: string
      nextFieldDefinitions?: StoredActivityFieldDefinition[]
      nextFieldConfig?: ActivityFieldConfig
      nextShowMocActivity?: boolean
      nextChartDefinitions?: StoredDashboardChartDefinition[]
      nextChartConfig?: DashboardChartConfig
      nextCardDefinitions?: StoredDashboardCardDefinition[]
      nextCardConfig?: DashboardCardConfig
      nextLayoutConfig?: LayoutConfig
    }
  ) => {
    if (!webappName.trim()) {
      throw new Error('In-app name is required before saving editor changes.')
    }

    const resolvedFieldDefinitions = options.nextFieldDefinitions ?? fieldDefinitions
    const resolvedFieldConfig = options.nextFieldConfig ?? fieldConfig
    const resolvedShowMocActivity = options.nextShowMocActivity ?? deriveMocActivityVisibility(resolvedFieldDefinitions, resolvedFieldConfig)
    const resolvedChartDefinitions = options.nextChartDefinitions ?? chartDefinitions
    const resolvedChartConfig = options.nextChartConfig ?? chartConfig
    const resolvedCardDefinitions = options.nextCardDefinitions ?? cardDefinitions
    const resolvedCardConfig = options.nextCardConfig ?? cardConfig
    const resolvedLayoutConfig = options.nextLayoutConfig ?? layoutConfig

    const updatedSettings = await updateSettings(
      {
        webapp_name: webappName.trim(),
        logo_url: logoFile ? currentSettings.logo_url || '' : logoPreview || currentSettings.logo_url || '',
        browser_tab_name: browserTabName.trim() || webappName.trim(),
        favicon_url: faviconFile
          ? currentSettings.favicon_url || currentSettings.logo_url || ''
          : faviconPreview || logoPreview || currentSettings.favicon_url || currentSettings.logo_url || '',
        performer_mode: performerMode,
        show_moc_activity: resolvedShowMocActivity,
        header_font_family: headerFontFamily.trim(),
        subheader_font_family: subheaderFontFamily.trim(),
        sidebar_font_family: sidebarFontFamily.trim(),
        activity_field_definitions: resolvedFieldDefinitions,
        activity_field_config: resolvedFieldConfig,
        dashboard_chart_definitions: resolvedChartDefinitions,
        dashboard_chart_config: resolvedChartConfig,
        dashboard_card_definitions: resolvedCardDefinitions,
        dashboard_card_config: resolvedCardConfig,
        layout_config: resolvedLayoutConfig,
      },
      user.id,
      activeTeam
    )

    onSettingsUpdate(updatedSettings)
    setSuccess(options.successMessage)
    return updatedSettings
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!webappName.trim()) {
      setError('In-app name is required.')
      return
    }

    try {
      setIsSubmitting(true)

      let nextLogoUrl = currentSettings.logo_url || ''
      let nextFaviconUrl = currentSettings.favicon_url || currentSettings.logo_url || ''

      if (logoFile) {
        nextLogoUrl = await uploadBrandingAsset(user.id, 'logo', logoFile)
      }

      if (faviconFile) {
        nextFaviconUrl = await uploadBrandingAsset(user.id, 'favicon', faviconFile)
      }

      const normalizedFieldConfig = normalizeSequentialFieldOrder(currentSettings, fieldDefinitions, fieldConfig)
      const normalizedShowMocActivity = deriveMocActivityVisibility(fieldDefinitions, normalizedFieldConfig)
      const normalizedChartConfig = normalizeSequentialChartOrder(
        { ...currentSettings, activity_field_definitions: fieldDefinitions, activity_field_config: normalizedFieldConfig },
        chartDefinitions,
        chartConfig
      )
      const normalizedCardConfig = normalizeSequentialCardOrder(
        { ...currentSettings, dashboard_card_definitions: cardDefinitions },
        cardDefinitions,
        cardConfig
      )

      const updatedSettings = await updateSettings(
        {
          webapp_name: webappName.trim(),
          logo_url: nextLogoUrl,
          browser_tab_name: browserTabName.trim() || webappName.trim(),
          favicon_url: nextFaviconUrl,
          performer_mode: performerMode,
          show_moc_activity: normalizedShowMocActivity,
          header_font_family: headerFontFamily.trim(),
          subheader_font_family: subheaderFontFamily.trim(),
          sidebar_font_family: sidebarFontFamily.trim(),
          activity_field_config: normalizedFieldConfig,
          activity_field_definitions: fieldDefinitions,
          dashboard_chart_config: normalizedChartConfig,
          dashboard_chart_definitions: chartDefinitions,
          dashboard_card_config: normalizedCardConfig,
          dashboard_card_definitions: cardDefinitions,
          layout_config: layoutConfig,
        },
        user.id,
        activeTeam
      )

      if (updatedSettings) {
        onSettingsUpdate(updatedSettings)
        setSuccess('Admin settings saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save admin settings.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!canManageSettings) {
    return (
      <div className="modal-overlay">
        <div className="settings-modal admin-settings-modal">
          <div className="modal-header">
            <h2>Admin Settings</h2>
            <button className="modal-close" onClick={onClose} type="button">
              Close
            </button>
          </div>
          <div className="permission-notice">
            <p>Only Admin and Super Admin users can manage dynamic fields, charts, cards, and team layout settings.</p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="modal-overlay">
        <div className="settings-modal admin-settings-modal">
          <div className="modal-header">
            <div>
              <h2>{user.is_superadmin ? 'Super Admin Settings' : 'Admin Settings'}</h2>
              <p className="form-hint admin-editor-header-copy">
                Configure branding, dynamic fields, charts, cards, and responsive layout for {activeTeam?.name || 'the active team'}.
              </p>
            </div>
            <button className="modal-close" onClick={onClose} type="button">
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="admin-settings-form-shell">
            {error ? <div className="error-message">{error}</div> : null}
            {success ? <div className="success-message">{success}</div> : null}

            <SectionCard title="Branding and Identity">
              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label htmlFor="webapp-name">In-App Name</label>
                  <input id="webapp-name" type="text" value={webappName} onChange={(event) => setWebappName(event.target.value)} disabled={isSubmitting || isLoading} />
                </div>
                <div className="form-group">
                  <label htmlFor="browser-tab-name">Browser Tab Name</label>
                  <input
                    id="browser-tab-name"
                    type="text"
                    value={browserTabName}
                    onChange={(event) => setBrowserTabName(event.target.value)}
                    disabled={isSubmitting || isLoading}
                  />
                </div>
              </div>

              <div className="form-row form-row-two-up">
                <div className="form-group">
                  <label>In-App Logo</label>
                  <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleLogoSelect} disabled={isSubmitting || isLoading} />
                  {logoPreview ? (
                    <div className="logo-preview">
                      <img src={logoPreview} alt="Logo preview" />
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label>Favicon</label>
                  <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleFaviconSelect} disabled={isSubmitting || isLoading} />
                  {faviconPreview ? (
                    <div className="logo-preview">
                      <img src={faviconPreview} alt="Favicon preview" />
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Behavior and Typography">
              <div className="form-group">
                <label>Performer Handling</label>
                <div className="radio-group admin-performer-row">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="performer-mode"
                      value="manual"
                      checked={performerMode === 'manual'}
                      onChange={() => setPerformerMode('manual')}
                      disabled={isSubmitting || isLoading}
                    />
                    <span className="radio-label admin-performer-option-label"> ✏️ Manual entry</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="performer-mode"
                      value="auto"
                      checked={performerMode === 'auto'}
                      onChange={() => setPerformerMode('auto')}
                      disabled={isSubmitting || isLoading}
                    />
                    <span className="radio-label admin-performer-option-label"> 🔏 Auto-assign current user</span>
                  </label>
                </div>
              </div>

              <div className="form-row admin-typography-row">
                <div className="form-group">
                  <label>Headers</label>
                  <input
                    type="text"
                    value={headerFontFamily}
                    onChange={(event) => setHeaderFontFamily(event.target.value)}
                    placeholder="Font family"
                    disabled={isSubmitting || isLoading}
                  />
                </div>
                <div className="form-group">
                  <label>Subheaders</label>
                  <input
                    type="text"
                    value={subheaderFontFamily}
                    onChange={(event) => setSubheaderFontFamily(event.target.value)}
                    placeholder="Font family"
                    disabled={isSubmitting || isLoading}
                  />
                </div>
                <div className="form-group">
                  <label>Sidebar</label>
                  <input
                    type="text"
                    value={sidebarFontFamily}
                    onChange={(event) => setSidebarFontFamily(event.target.value)}
                    placeholder="Font family"
                    disabled={isSubmitting || isLoading}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dynamic Editors">
              <div className="editor-launch-grid">
                <EditorLaunchCard
                  title="Team Activity Fields Editor"
                  description="Create, edit, reorder, enable, require, and delete fields."
                  countLabel="Fields"
                  countValue={orderedFields.length}
                  onOpen={() => setActiveEditor('fields')}
                  isBusy={isSubmitting || isLoading}
                />
                <EditorLaunchCard
                  title="Dashboard Charts Editor"
                  description="Manage charts and dashboard visibility."
                  countLabel="Charts"
                  countValue={orderedCharts.length}
                  onOpen={() => setActiveEditor('charts')}
                  isBusy={isSubmitting || isLoading}
                />
                <EditorLaunchCard
                  title="Dashboard Cards Editor"
                  description="Manage KPI cards and visibility."
                  countLabel="Cards"
                  countValue={orderedCards.length}
                  onOpen={() => setActiveEditor('cards')}
                  isBusy={isSubmitting || isLoading}
                />
              </div>
            </SectionCard>

            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoading}>
                {isSubmitting ? 'Saving...' : 'Save Settings'}
              </button>
              {user.is_superadmin ? (
                <button type="button" className="btn btn-user-management" onClick={onOpenUserManagement} disabled={isSubmitting || isLoading}>
                  Open User Management
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting || isLoading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {activeEditor === 'fields' ? (
        <FieldsEditor
          currentSettings={currentSettings}
          fieldDefinitions={fieldDefinitions}
          fieldConfig={fieldConfig}
          reusableFieldOptions={reusableFieldOptions}
          showMocActivity={showMocActivity}
          onShowMocActivityChange={setShowMocActivity}
          onApply={async (definitions, config) => {
            setError('')
            setSuccess('')
            setIsSubmitting(true)
            try {
              const nextShowMocActivity = deriveMocActivityVisibility(definitions, config)
              setFieldDefinitions(definitions)
              setFieldConfig(config)
              setShowMocActivity(nextShowMocActivity)
              await persistSettingsDraft(
                {
                  show_moc_activity: nextShowMocActivity,
                  activity_field_definitions: definitions,
                  activity_field_config: config,
                },
                {
                  successMessage: 'Field settings saved.',
                  nextFieldDefinitions: definitions,
                  nextFieldConfig: config,
                  nextShowMocActivity,
                }
              )
              setActiveEditor(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save field settings.')
            } finally {
              setIsSubmitting(false)
            }
          }}
          onCancel={() => setActiveEditor(null)}
          isBusy={isSubmitting || isLoading}
        />
      ) : null}

      {activeEditor === 'charts' ? (
        <ChartsEditor
          currentSettings={currentSettings}
          fieldDefinitions={fieldDefinitions}
          fieldConfig={fieldConfig}
          chartDefinitions={chartDefinitions}
          chartConfig={chartConfig}
          reusableChartOptions={reusableChartOptions}
          onApply={async (definitions, config) => {
            setError('')
            setSuccess('')
            setIsSubmitting(true)
            try {
              setChartDefinitions(definitions)
              setChartConfig(config)
              await persistSettingsDraft(
                {
                  dashboard_chart_definitions: definitions,
                  dashboard_chart_config: config,
                },
                {
                  successMessage: 'Chart settings saved.',
                  nextChartDefinitions: definitions,
                  nextChartConfig: config,
                }
              )
              setActiveEditor(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save chart settings.')
            } finally {
              setIsSubmitting(false)
            }
          }}
          onCancel={() => setActiveEditor(null)}
          isBusy={isSubmitting || isLoading}
        />
      ) : null}

      {activeEditor === 'cards' ? (
        <CardsEditor
          currentSettings={currentSettings}
          cardDefinitions={cardDefinitions}
          cardConfig={cardConfig}
          fieldSettings={{
            ...currentSettings,
            activity_field_definitions: fieldDefinitions,
            activity_field_config: fieldConfig,
          }}
          reusableCardOptions={reusableCardOptions}
          onApply={async (definitions, config) => {
            setError('')
            setSuccess('')
            setIsSubmitting(true)
            try {
              setCardDefinitions(definitions)
              setCardConfig(config)
              await persistSettingsDraft(
                {
                  dashboard_card_definitions: definitions,
                  dashboard_card_config: config,
                },
                {
                  successMessage: 'Card settings saved.',
                  nextCardDefinitions: definitions,
                  nextCardConfig: config,
                }
              )
              setActiveEditor(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save card settings.')
            } finally {
              setIsSubmitting(false)
            }
          }}
          onCancel={() => setActiveEditor(null)}
          isBusy={isSubmitting || isLoading}
        />
      ) : null}
    </>
  )
}

export const SuperAdminPanel = AdminPanel
