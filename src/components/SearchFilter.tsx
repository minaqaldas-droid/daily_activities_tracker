import React, { useState } from 'react'
import { SYSTEM_OPTIONS } from '../constants/systems'
import { type SearchFilters } from '../supabaseClient'

interface SearchFilterProps {
  onSearch: (filters: SearchFilters) => void | Promise<void>
  isLoading?: boolean
}

type DateFilterMode = 'all' | 'single' | 'range'

export const SearchFilter: React.FC<SearchFilterProps> = ({ onSearch, isLoading = false }) => {
  const [keyword, setKeyword] = useState('')
  const [dateMode, setDateMode] = useState<DateFilterMode>('all')
  const [singleDate, setSingleDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [performer, setPerformer] = useState('')
  const [system, setSystem] = useState('')
  const [instrument, setInstrument] = useState('')

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    const filters: SearchFilters = {
      keyword: keyword || undefined,
      performer: performer || undefined,
      instrument: instrument || undefined,
      system: system || undefined,
    }

    if (dateMode === 'single') {
      filters.date = singleDate || undefined
    }

    if (dateMode === 'range') {
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
    setPerformer('')
    setSystem('')
    setInstrument('')
    setDateMode('all')
    await onSearch({})
  }

  const hasActiveFilters = Boolean(
    keyword || singleDate || startDate || endDate || performer || system || instrument
  )

  return (
    <form onSubmit={handleSearch} className="search-filter">
      <div className="search-header">
        <h3>Search & Filter Activities</h3>
        <p>Combine keyword, date, and activity details to quickly narrow down results.</p>
      </div>

      <div className="search-layout">
        <section className="search-card">
          <div className="search-card-header">
            <h4>Keyword</h4>
            <p>Search across all text fields in the activity log.</p>
          </div>

          <div className="form-group">
            <label htmlFor="keywordSearch">Keyword</label>
            <input
              type="text"
              id="keywordSearch"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search any word in activities..."
              disabled={isLoading}
              className="keyword-input"
            />
            <small>
              Searches date, performer, system, instrument/tag, problem, action, and comments.
            </small>
          </div>
        </section>

        <section className="search-card search-card-wide">
          <div className="search-card-header">
            <h4>Date Filter</h4>
            <p>Choose whether to search all time, a specific date, or a date range.</p>
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
                  onChange={(e) => setSingleDate(e.target.value)}
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
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">To</label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="search-card">
          <div className="search-card-header">
            <h4>Field Filters</h4>
            <p>Refine results using structured activity details.</p>
          </div>

          <div className="search-grid">
            <div className="form-group">
              <label htmlFor="filterSystem">System</label>
              <select
                id="filterSystem"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                disabled={isLoading}
              >
                <option value="">All Systems</option>
                {SYSTEM_OPTIONS.map((systemOption) => (
                  <option key={systemOption} value={systemOption}>
                    {systemOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="filterPerformer">Performer</label>
              <input
                type="text"
                id="filterPerformer"
                value={performer}
                onChange={(e) => setPerformer(e.target.value)}
                placeholder="Search performer name..."
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="filterInstrument">Instrument/Tag</label>
              <input
                type="text"
                id="filterInstrument"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder="Search instrument or tag..."
                disabled={isLoading}
              />
            </div>
          </div>
        </section>
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
