import { useCallback, useEffect, useState } from 'react'
import {
  type Activity,
  type SearchFilters,
  createActivity,
  deleteActivity,
  getActivities,
  searchActivities,
  updateActivity,
} from '../supabaseClient'

function hasSearchFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => Boolean(value))
}

interface UseActivitiesOptions {
  currentUserName?: string
  performerMode?: 'manual' | 'auto'
}

interface SaveActivityOptions {
  editingId?: string | null
  editingData?: Activity
}

export function useActivities({ currentUserName = '', performerMode = 'manual' }: UseActivitiesOptions) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [searchApplied, setSearchApplied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({})

  const loadActivities = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await getActivities()
      setActivities(data)

      if (hasSearchFilters(activeFilters)) {
        const results = await searchActivities(activeFilters)
        setFilteredActivities(results)
        setSearchApplied(true)
      } else {
        setFilteredActivities(data)
        setSearchApplied(false)
      }

      return data
    } finally {
      setIsLoading(false)
    }
  }, [activeFilters])

  useEffect(() => {
    if (!hasSearchFilters(activeFilters)) {
      setFilteredActivities(activities)
    }
  }, [activeFilters, activities])

  const saveActivity = useCallback(
    async (activity: Activity, options: SaveActivityOptions = {}) => {
      setIsLoading(true)

      try {
        if (options.editingId) {
          const updateData = {
            date: activity.date,
            performer: activity.performer,
            system: activity.system,
            activityType: activity.activityType,
            tag: activity.tag,
            problem: activity.problem,
            action: activity.action,
            comments: activity.comments,
            editedBy: currentUserName || undefined,
          }

          await updateActivity(options.editingId, updateData)
        } else {
          const performer =
            performerMode === 'auto' && currentUserName ? currentUserName : activity.performer

          await createActivity({
            ...activity,
            performer,
          })
        }

        await loadActivities()
      } finally {
        setIsLoading(false)
      }
    },
    [currentUserName, loadActivities, performerMode]
  )

  const removeActivity = useCallback(
    async (id: string) => {
      setIsLoading(true)

      try {
        await deleteActivity(id)
        await loadActivities()
      } finally {
        setIsLoading(false)
      }
    },
    [loadActivities]
  )

  const runSearch = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true)

    try {
      setActiveFilters(filters)

      if (!hasSearchFilters(filters)) {
        setFilteredActivities(activities)
        setSearchApplied(false)
        return activities
      }

      const results = await searchActivities(filters)
      setFilteredActivities(results)
      setSearchApplied(true)
      return results
    } finally {
      setIsLoading(false)
    }
  }, [activities])

  const resetActivities = useCallback(() => {
    setActivities([])
    setFilteredActivities([])
    setActiveFilters({})
    setSearchApplied(false)
  }, [])

  return {
    activities,
    filteredActivities,
    isLoading,
    searchApplied,
    loadActivities,
    saveActivity,
    removeActivity,
    runSearch,
    resetActivities,
  }
}
