/**
 * Read-only helpers over the server's outline. They count and look things up; they never
 * decide whether something is locked (ADR 0002: the server is the authority).
 */
import type { ClassOutline, NextActivity, OutlineActivity, OutlineLesson, OutlineModule } from './types'

export type Located = { module: OutlineModule; lesson: OutlineLesson; activity: OutlineActivity }

export function locate(outline: ClassOutline, activityId: string): Located | null {
  for (const module of outline.modules)
    for (const lesson of module.lessons)
      for (const activity of lesson.activities) if (activity.activity_id === activityId) return { module, lesson, activity }
  return null
}

/** What "Start here" points at. */
export type NextStep =
  | { kind: 'pretest'; module: OutlineModule; assessment_id: string }
  | { kind: 'activity'; module: OutlineModule; lesson: OutlineLesson; activity: OutlineActivity }
  | { kind: 'posttest'; module: OutlineModule; assessment_id: string }
  | { kind: 'done' }

/**
 * The server's next_activity is null both when the student is finished AND when the next step
 * is a module's pre-test or post-test, so null alone never means "done": the outline decides.
 * A pre-test that is up next in an earlier (or the same) module comes before the activity.
 */
export function nextStep(outline: ClassOutline, next: NextActivity): NextStep {
  const found = next ? locate(outline, next.activity_id) : null
  const pre = outline.modules.findIndex((m) => m.pretest?.status === 'available')
  if (pre !== -1 && (!found || pre <= outline.modules.indexOf(found.module))) {
    return { kind: 'pretest', module: outline.modules[pre]!, assessment_id: outline.modules[pre]!.pretest!.assessment_id }
  }
  if (found) return { kind: 'activity', ...found }
  const module = outline.modules.find((m) => m.posttest?.status === 'available')
  if (module) return { kind: 'posttest', module, assessment_id: module.posttest!.assessment_id }
  return { kind: 'done' }
}

/** Display only: the database sends long decimals (100.000000000000000000000). */
export const whole = (n: number): number => Math.round(n)

export type Tally = { done: number; total: number; pct: number }

// Skipped work (a late joiner placed at a later module) is neither done nor missing.
function tally(all: OutlineActivity[]): Tally {
  const activities = all.filter((a) => a.status !== 'skipped')
  const total = activities.length
  const done = activities.filter((a) => a.status === 'done').length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export const moduleTally = (m: OutlineModule): Tally => tally(m.lessons.flatMap((l) => l.activities))
export const overallTally = (o: ClassOutline): Tally => tally(o.modules.flatMap((m) => m.lessons.flatMap((l) => l.activities)))

/** A module's pretest gates it (B7): taken = status 'done'; a skipped module owes no pre-test. */
export const needsPretest = (m: OutlineModule): boolean =>
  m.pretest !== null && m.pretest.status !== 'done' && m.pretest.status !== 'skipped'

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
