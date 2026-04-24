import React, { useEffect, useState } from 'react'
import { type ActivityTypeValue, ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { SYSTEM_OPTIONS } from '../constants/systems'
import { getEditors, type SearchFilters, type Team } from '../supabaseClient'

interface SearchFilterProps {
  onSearch: (filters: SearchFilters) => void | Promise<void>
  isLoading?: boolean
  activeTeam?: Team | null
}

type DateFilterMode = 'all' | 'single' | 'range'

export const SearchFilter: React.FC<SearchFilterProps> = ({ onSearch, isLoading = false, activeTeam }) => {
  const [keyword, setKeyword] = useState('')
  const [dateMode, setDateMode] = useState<DateFilterMode>('all')
  const [singleDate, setSingleDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [performer, setPerformer] = useState('')
  const [performers, setPerformers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [isLoadingPerformers, setIsLoadingPerformers] = useState(false)
  const [system, setSystem] = useState('')
  const [activityType, setActivityType] = useState<ActivityTypeValue | ''>('')
  const [tag, setTag] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadPerformers = async () => {
      try {
        setIsLoadingPerformers(true)
        const users = await getEditors(activeTeam)
        if (isMounted) {
          setPerformers(users || [])
        }
      } catch (error) {
        console.error('Failed to load performers for search:', error)
      } finally {
        if (isMounted) {
          setIsLoadingPerformers(false)
        }
      }
    }

    void loadPerformers()

    return () => {
      isMounted = false
    }
  }, [activeTeam])

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
      tag: tag || undefined,
      system: system || undefined,
      activityType: activityType || undefined,
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
    setActivityType('')
    setTag('')
    setDateMode('all')
    await onSearch({})
  }

  const hasActiveFilters = Boolean(
    keyword || singleDate || startDate || endDate || performer || system || activityType || tag
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
              onChange={(e) => setKeyword(e.target.value)}
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
              <select
                id="filterPerformer"
                value={performer}
                onChange={(e) => setPerformer(e.target.value)}
                disabled={isLoading || isLoadingPerformers}
              >
                <option value="">All Performers</option>
                {performers.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="filterActivityType">Activity Type</label>
              <select
                id="filterActivityType"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityTypeValue | '')}
                disabled={isLoading}
              >
                <option value="">All Activity Types</option>
                {ACTIVITY_TYPE_OPTIONS.map((activityTypeOption) => (
                  <option key={activityTypeOption.value} value={activityTypeOption.value}>
                    {activityTypeOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="filterTag">Tag</label>
              <input
                type="text"
                id="filterTag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Search tag..."
                disabled={isLoading}
              />
            </div>
          </div>
        </section>

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
