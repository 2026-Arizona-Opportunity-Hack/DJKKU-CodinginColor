/**
 * Read-only helpers over the server's outline. They count and look things up; they never
 * decide whether something is locked (ADR 0002: the server is the authority).
 */
import type { ClassOutline, OutlineActivity, OutlineLesson, OutlineModule } from './types'

export type Located = { module: OutlineModule; lesson: OutlineLesson; activity: OutlineActivity }

export function locate(outline: ClassOutline, activityId: string): Located | null {
  for (const module of outline.modules)
    for (const lesson of module.lessons)
      for (const activity of lesson.activities) if (activity.activity_id === activityId) return { module, lesson, activity }
  return null
}

export type Tally = { done: number; total: number; pct: number }

function tally(activities: OutlineActivity[]): Tally {
  const total = activities.length
  const done = activities.filter((a) => a.status === 'done').length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export const moduleTally = (m: OutlineModule): Tally => tally(m.lessons.flatMap((l) => l.activities))
export const overallTally = (o: ClassOutline): Tally => tally(o.modules.flatMap((m) => m.lessons.flatMap((l) => l.activities)))

/** A module's pretest gates it (B7): taken = status 'done'. */
export const needsPretest = (m: OutlineModule): boolean => m.pretest !== null && m.pretest.status !== 'done'

export const KIND_LABEL: Record<OutlineActivity['kind'], string> = {
  video: 'Video',
  reading: 'Reading',
  check: 'Check',
  worksheet: 'Worksheet',
  exit: 'Exit ticket',
}

export const paths = {
  home: '/learn',
  /** Sign-in lives in the auth feature (src/features/auth), not in the player. */
  signIn: '/sign-in',
  explore: '/learn/explore',
  save: '/learn/explore/save',
  path: (classId: string) => `/learn/${classId}`,
  activity: (classId: string, activityId: string) => `/learn/${classId}/a/${activityId}`,
  test: (classId: string, assessmentId: string) => `/learn/${classId}/test/${assessmentId}`,
  progress: (classId: string) => `/learn/${classId}/progress`,
  guestActivity: (activityId: string) => `/learn/explore/a/${activityId}`,
}
