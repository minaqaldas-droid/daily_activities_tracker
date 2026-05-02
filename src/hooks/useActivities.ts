import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Activity,
  type SearchFilters,
  type Team,
  createActivity,
  deleteActivity,
  getActivities,
  getRecentActivities,
  searchActivities,
  updateActivity,
} from '../supabaseClient'

function hasSearchFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => Boolean(value))
}

function getTeamCacheKey(team?: Team | null) {
  return team?.id || '__no-team__'
}

function getSearchCacheKey(filters: SearchFilters) {
  return JSON.stringify(
    Object.entries(filters)
      .filter(([, value]) => Boolean(value))
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
  )
}

interface UseActivitiesOptions {
  currentUserName?: string
  performerMode?: 'manual' | 'auto'
  activeTeam?: Team | null
}

interface SaveActivityOptions {
  editingId?: string | null
  editingData?: Activity
  refreshMode?: 'full' | 'recent'
}

interface TeamActivitiesCacheEntry {
  activities?: Activity[]
  recentByLimit: Record<string, Activity[]>
  searchResultsByKey: Record<string, Activity[]>
}

export function useActivities({ currentUserName = '', performerMode = 'manual', activeTeam }: UseActivitiesOptions) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [latestActivities, setLatestActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [searchApplied, setSearchApplied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({})
  const activitiesCacheRef = useRef<Map<string, TeamActivitiesCacheEntry>>(new Map())
  const requestIdRef = useRef(0)

  const loadActivities = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const teamKey = getTeamCacheKey(activeTeam)
    const searchKey = getSearchCacheKey(activeFilters)
    const cachedEntry = activitiesCacheRef.current.get(teamKey)
    const shouldApplySearch = hasSearchFilters(activeFilters)

    if (cachedEntry?.activities) {
      setActivities(cachedEntry.activities)

      if (shouldApplySearch) {
        const cachedSearchResults = cachedEntry.searchResultsByKey[searchKey]
        if (cachedSearchResults) {
          setFilteredActivities(cachedSearchResults)
          setSearchApplied(true)
        }
      } else {
        setFilteredActivities(cachedEntry.activities)
        setSearchApplied(false)
      }
    }

    setIsLoading(!cachedEntry?.activities)

    try {
      const data = await getActivities(activeTeam)
      const nextCacheEntry: TeamActivitiesCacheEntry = {
        activities: data,
        recentByLimit: cachedEntry?.recentByLimit || {},
        searchResultsByKey: cachedEntry?.searchResultsByKey || {},
      }
      activitiesCacheRef.current.set(teamKey, nextCacheEntry)

      if (requestId === requestIdRef.current) {
        setActivities(data)
      }

      if (shouldApplySearch) {
        const results = await searchActivities(activeFilters, activeTeam)
        nextCacheEntry.searchResultsByKey[searchKey] = results
        activitiesCacheRef.current.set(teamKey, nextCacheEntry)

        if (requestId === requestIdRef.current) {
          setFilteredActivities(results)
          setSearchApplied(true)
        }
      } else if (requestId === requestIdRef.current) {
        setFilteredActivities(data)
        setSearchApplied(false)
      }

      return data
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [activeFilters, activeTeam])

  const loadRecentActivities = useCallback(async (limit = 10) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const teamKey = getTeamCacheKey(activeTeam)
    const cachedEntry = activitiesCacheRef.current.get(teamKey)
    const recentCacheKey = String(limit)
    const cachedRecentActivities = cachedEntry?.recentByLimit[recentCacheKey]

    if (cachedRecentActivities) {
      setLatestActivities(cachedRecentActivities)
      if (!hasSearchFilters(activeFilters)) {
        setFilteredActivities(cachedRecentActivities)
        setSearchApplied(false)
      }
    }

    setIsLoading(!cachedRecentActivities)

    try {
      const recentActivities = await getRecentActivities(limit, activeTeam)
      const nextCacheEntry: TeamActivitiesCacheEntry = {
        activities: cachedEntry?.activities,
        recentByLimit: {
          ...(cachedEntry?.recentByLimit || {}),
          [recentCacheKey]: recentActivities,
        },
        searchResultsByKey: cachedEntry?.searchResultsByKey || {},
      }
      activitiesCacheRef.current.set(teamKey, nextCacheEntry)

      if (requestId === requestIdRef.current) {
        setLatestActivities(recentActivities)
        if (!hasSearchFilters(activeFilters)) {
          setFilteredActivities(recentActivities)
          setSearchApplied(false)
        }
      }

      return recentActivities
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [activeFilters, activeTeam])

  useEffect(() => {
    if (!hasSearchFilters(activeFilters)) {
      setFilteredActivities(activities.length > 0 ? activities : latestActivities)
    }
  }, [activeFilters, activities, latestActivities])

  const saveActivity = useCallback(
    async (activity: Activity, options: SaveActivityOptions = {}) => {
      setIsLoading(true)

      try {
        if (options.editingId) {
          const updateData = {
            date: activity.date,
            performer: activity.performer,
            system: activity.system,
            shift: activity.shift,
            permitNumber: activity.permitNumber,
            instrumentType: activity.instrumentType,
            activityType: activity.activityType,
            tag: activity.tag,
            problem: activity.problem,
            action: activity.action,
            comments: activity.comments,
            editedBy: currentUserName || undefined,
            edited_at: new Date().toISOString(),
          }

          await updateActivity(options.editingId, updateData, activeTeam)
        } else {
          const performer =
            performerMode === 'auto' && currentUserName ? currentUserName : activity.performer

          await createActivity({
            ...activity,
            performer,
          }, activeTeam)
        }

        activitiesCacheRef.current.delete(getTeamCacheKey(activeTeam))

        if (options.refreshMode === 'full') {
          await loadActivities()
        } else {
          await loadRecentActivities()
        }
      } finally {
        setIsLoading(false)
      }
    },
    [activeTeam, currentUserName, loadActivities, loadRecentActivities, performerMode]
  )

  const removeActivity = useCallback(
    async (id: string, refreshMode: 'full' | 'recent' = 'recent') => {
      setIsLoading(true)

      try {
        await deleteActivity(id, activeTeam)
        activitiesCacheRef.current.delete(getTeamCacheKey(activeTeam))

        if (refreshMode === 'full') {
          await loadActivities()
        } else {
          await loadRecentActivities()
        }
      } finally {
        setIsLoading(false)
      }
    },
    [activeTeam, loadActivities, loadRecentActivities]
  )

  const runSearch = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true)

    try {
      setActiveFilters(filters)

      if (!hasSearchFilters(filters)) {
        const recentActivities = await loadRecentActivities(10)
        setFilteredActivities(recentActivities)
        setSearchApplied(false)
        return recentActivities
      }

      const teamKey = getTeamCacheKey(activeTeam)
      const searchKey = getSearchCacheKey(filters)
      const cachedEntry = activitiesCacheRef.current.get(teamKey)
      const cachedSearchResults = cachedEntry?.searchResultsByKey[searchKey]

      if (cachedSearchResults) {
        setFilteredActivities(cachedSearchResults)
        setSearchApplied(true)
        return cachedSearchResults
      }

      const results = await searchActivities(filters, activeTeam)
      const nextCacheEntry: TeamActivitiesCacheEntry = {
        activities: cachedEntry?.activities,
        recentByLimit: cachedEntry?.recentByLimit || {},
        searchResultsByKey: {
          ...(cachedEntry?.searchResultsByKey || {}),
          [searchKey]: results,
        },
      }
      activitiesCacheRef.current.set(teamKey, nextCacheEntry)
      setFilteredActivities(results)
      setSearchApplied(true)
      return results
    } finally {
      setIsLoading(false)
    }
  }, [activeTeam, loadRecentActivities])

  const resetActivities = useCallback(() => {
    setActivities([])
    setLatestActivities([])
    setFilteredActivities([])
    setActiveFilters({})
    setSearchApplied(false)
    requestIdRef.current += 1
  }, [])

  return {
    activities,
    latestActivities,
    filteredActivities,
    isLoading,
    searchApplied,
    loadActivities,
    loadRecentActivities,
    saveActivity,
    removeActivity,
    runSearch,
    resetActivities,
  }
}
