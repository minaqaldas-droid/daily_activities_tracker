export type DashboardResultsFilter =
  | { kind: 'all' }
  | { kind: 'performer'; performer: string }
  | { kind: 'performerIn'; performers: string[] }
  | { kind: 'hasField'; field: 'performer' | 'system' | 'tag' | 'editedBy' }
  | { kind: 'recentlyEdited'; limit: number }
  | { kind: 'sinceDate'; sinceDate: string }
  | { kind: 'activityType'; activityType: string }
  | { kind: 'system'; system: string }
  | { kind: 'shift'; shift: string }
  | { kind: 'instrumentType'; instrumentType: string }
  | { kind: 'tag'; tag: string }
