import { useCallback, useRef, useState } from 'react'
import {
  type Activity,
  type Team,
  getDashboardActivities,
  getRecentActivities,
} from '../supabaseClient'

function getTeamCacheKey(team?: Team | null) {
  return team?.id || '__no-team__'
}

interface DashboardActivitiesCacheEntry {
  summaryActivities: Activity[]
  recentActivities: Activity[]
}

export function useDashboardActivities(activeTeam?: Team | null) {
  const [summaryActivities, setSummaryActivities] = useState<Activity[]>([])
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef<Map<string, DashboardActivitiesCacheEntry>>(new Map())
  const requestIdRef = useRef(0)

  const loadDashboardActivities = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const teamKey = getTeamCacheKey(activeTeam)
    const cachedEntry = cacheRef.current.get(teamKey)

    if (cachedEntry) {
      setSummaryActivities(cachedEntry.summaryActivities)
      setRecentActivities(cachedEntry.recentActivities)
    }

    setIsLoading(!cachedEntry)

    try {
      const [nextSummaryActivities, nextRecentActivities] = await Promise.all([
        getDashboardActivities(activeTeam),
        getRecentActivities(5, activeTeam),
      ])

      cacheRef.current.set(teamKey, {
        summaryActivities: nextSummaryActivities,
        recentActivities: nextRecentActivities,
      })

      if (requestId === requestIdRef.current) {
        setSummaryActivities(nextSummaryActivities)
        setRecentActivities(nextRecentActivities)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [activeTeam])

  const invalidateDashboardActivities = useCallback(() => {
    cacheRef.current.delete(getTeamCacheKey(activeTeam))
  }, [activeTeam])

  const resetDashboardActivities = useCallback(() => {
    requestIdRef.current += 1
    setSummaryActivities([])
    setRecentActivities([])
    setIsLoading(false)
  }, [])

  return {
    summaryActivities,
    recentActivities,
    isLoading,
    loadDashboardActivities,
    invalidateDashboardActivities,
    resetDashboardActivities,
  }
}
