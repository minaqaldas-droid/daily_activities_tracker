import React, { useEffect, useState } from 'react'
import { type ActivityTypeValue, ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { type SearchFilters, type Settings, type Team } from '../supabaseClient'
import {
  type ConfigurableActivityFieldKey,
  getEnabledActivityFields,
  getOrderedActivityFields,
} from '../utils/activityFields'
import { getSystemFieldOptions } from '../utils/teamActivityField'

interface SearchFilterProps {
  onSearch: (filters: SearchFilters) => void | Promise<void>
  isLoading?: boolean
  activeTeam?: Team | null
  settings?: Settings
}

type DateFilterMode = 'all' | 'single' | 'range'
type DynamicFilterValues = Partial<Record<ConfigurableActivityFieldKey, string>>

export const SearchFilter: React.FC<SearchFilterProps> = ({ onSearch, isLoading = false, activeTeam, settings }) => {
  const [keyword, setKeyword] = useState('')
  const [dateMode, setDateMode] = useState<DateFilterMode>('all')
  const [singleDate, setSingleDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fieldValues, setFieldValues] = useState<DynamicFilterValues>({})
  const [hasMoc, setHasMoc] = useState(false)
  const systemFieldOptions = getSystemFieldOptions(activeTeam)
  const visibleFields = getEnabledActivityFields(settings)
  const orderedFields = getOrderedActivityFields(settings)
  const dateFieldEnabled = visibleFields.some((field) => field.key === 'date')
  const filterableFields = orderedFields.filter(
    (field) => field.key !== 'date' && visibleFields.some((visibleField) => visibleField.key === field.key)
  )
  const commentsFieldVisible = visibleFields.some((field) => field.key === 'comments')

  const handleDateModeChange = (nextMode: DateFilterMode) => {
    setDateMode(nextMode)

    if (nextMode !== 'single') {
      setSingleDate('')
    }

    if (nextMode !== 'range') {
      setStartDate('')
      setEndDate('')
    }
  }

  const setFieldValue = (fieldKey: ConfigurableActivityFieldKey, value: string) => {
    setFieldValues((previous) => ({
      ...previous,
      [fieldKey]: value,
    }))
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()

    const filters: SearchFilters = {
      keyword: keyword || undefined,
      performer: fieldValues.performer || undefined,
      tag: fieldValues.tag || undefined,
      system: fieldValues.system || undefined,
      shift: fieldValues.shift || undefined,
      permitNumber: fieldValues.permitNumber || undefined,
      instrumentType: fieldValues.instrumentType || undefined,
      activityType: (fieldValues.activityType as ActivityTypeValue | '') || undefined,
      problem: fieldValues.problem || undefined,
      action: fieldValues.action || undefined,
      comments: fieldValues.comments || undefined,
      hasMoc: hasMoc || undefined,
    }

    if (dateFieldEnabled && dateMode === 'single') {
      filters.date = singleDate || undefined
    }

    if (dateFieldEnabled && dateMode === 'range') {
      filters.startDate = startDate || undefined
      filters.endDate = endDate || undefined
    }

    await onSearch(filters)
  }

  const handleReset = async () => {
    setKeyword('')
    setSingleDate('')
    setStartDate('')
    setEndDate('')
    setFieldValues({})
    setHasMoc(false)
    setDateMode('all')
    await onSearch({})
  }

  const hasActiveFilters = Boolean(
    keyword ||
      singleDate ||
      startDate ||
      endDate ||
      Object.values(fieldValues).some((value) => Boolean(value)) ||
      hasMoc
  )

  return (
    <form onSubmit={handleSearch} className="search-filter">
      <div className="search-header">
        <h3>🔍 Search & Filter Activities</h3>
      </div>

      <div className="search-layout">
        <section className="search-card">
          <div className="search-card-header">
            <h4>Keyword</h4>
          </div>

          <div className="form-group">
            <label htmlFor="keywordSearch">Keyword</label>
            <input
              type="text"
              id="keywordSearch"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search any word in activities..."
              disabled={isLoading}
              className="keyword-input"
            />
          </div>
        </section>

        <section className="search-card">
          <div className="search-card-header">
            <h4>Field Filters</h4>
          </div>

          <div className="search-grid">
            {filterableFields.map((field) => {
              if (field.key === 'performer') {
                return (
                  <div className="form-group" key={field.key}>
                    <label htmlFor="filterPerformer">{field.label}</label>
                    <input
                      id="filterPerformer"
                      type="text"
                      value={fieldValues.performer || ''}
                      onChange={(event) => setFieldValue('performer', event.target.value)}
                      placeholder="Search performer..."
                      disabled={isLoading}
                    />
                  </div>
                )
              }

              if (field.key === 'system') {
                return (
                  <div className="form-group" key={field.key}>
                    <label htmlFor="filterSystem">{field.label}</label>
                    <select
                      id="filterSystem"
                      value={fieldValues.system || ''}
                      onChange={(event) => setFieldValue('system', event.target.value)}
                      disabled={isLoading}
                    >
                      <option value="">All Systems</option>
                      {systemFieldOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (field.key === 'activityType') {
                return (
                  <div className="form-group" key={field.key}>
                    <label htmlFor="filterActivityType">{field.label}</label>
                    <select
                      id="filterActivityType"
                      value={fieldValues.activityType || ''}
                      onChange={(event) => setFieldValue('activityType', event.target.value)}
                      disabled={isLoading}
                    >
                      <option value="">All Activity Types</option>
                      {ACTIVITY_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              if (field.type === 'select') {
                return (
                  <div className="form-group" key={field.key}>
                    <label htmlFor={`filter-${field.key}`}>{field.label}</label>
                    <select
                      id={`filter-${field.key}`}
                      value={fieldValues[field.key] || ''}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                      disabled={isLoading}
                    >
                      <option value="">{`All ${field.label}`}</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              return (
                <div className="form-group" key={field.key}>
                  <label htmlFor={`filter-${field.key}`}>{field.label}</label>
                  <input
                    id={`filter-${field.key}`}
                    type="text"
                    value={fieldValues[field.key] || ''}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                    placeholder={`Search ${field.label.toLowerCase()}...`}
                    disabled={isLoading}
                  />
                </div>
              )
            })}

            {commentsFieldVisible && (
              <div className="form-group form-group-inline-checkbox moc-inline-cell">
                <div className="moc-inline-control">
                  <span className="moc-inline-title">MOC Activity</span>
                  <input
                    type="checkbox"
                    checked={hasMoc}
                    onChange={(event) => setHasMoc(event.target.checked)}
                    disabled={isLoading}
                    aria-label="Filter MOC Activity"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {dateFieldEnabled && (
          <section className="search-card search-card-wide">
            <div className="search-card-header">
              <h4>Date Filter</h4>
            </div>

            <div className="date-mode-grid" role="radiogroup" aria-label="Date filter mode">
              <label className={`date-mode-card ${dateMode === 'all' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="dateMode"
                  checked={dateMode === 'all'}
                  onChange={() => handleDateModeChange('all')}
                  disabled={isLoading}
                />
                <span className="date-mode-title">All Time</span>
                <span className="date-mode-description">Do not limit the results by date.</span>
              </label>

              <label className={`date-mode-card ${dateMode === 'single' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="dateMode"
                  checked={dateMode === 'single'}
                  onChange={() => handleDateModeChange('single')}
                  disabled={isLoading}
                />
                <span className="date-mode-title">Specific Date</span>
                <span className="date-mode-description">Show activities from one selected day.</span>
              </label>

              <label className={`date-mode-card ${dateMode === 'range' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="dateMode"
                  checked={dateMode === 'range'}
                  onChange={() => handleDateModeChange('range')}
                  disabled={isLoading}
                />
                <span className="date-mode-title">Date Range</span>
                <span className="date-mode-description">Filter between a start and end date.</span>
              </label>
            </div>

            {dateMode === 'all' && (
              <div className="date-input-panel date-input-panel-muted">
                <p>Date filtering is disabled. All dates will be included in the search.</p>
              </div>
            )}

            {dateMode === 'single' && (
              <div className="date-input-panel">
                <div className="form-group">
                  <label htmlFor="singleDate">Specific Date</label>
                  <input
                    type="date"
                    id="singleDate"
                    value={singleDate}
                    onChange={(event) => setSingleDate(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {dateMode === 'range' && (
              <div className="date-input-panel">
                <div className="form-row form-row-two-up">
                  <div className="form-group">
                    <label htmlFor="startDate">From</label>
                    <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="endDate">To</label>
                    <input
                      type="date"
                      id="endDate"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="search-actions">
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Apply Filters'}
        </button>
        {hasActiveFilters && (
          <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={isLoading}>
            Clear All
          </button>
        )}
      </div>
    </form>
  )
}
