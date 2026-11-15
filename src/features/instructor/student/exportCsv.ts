import { toCsv } from '@shared/authoring/csv'
import type { StudentReport } from './report'

/** One row per assigned activity. Uses the shared CSV writer, which stops cells running as formulas. */
export function reportCsv(r: StudentReport): string {
  return toCsv(
    ['module', 'lesson', 'activity', 'type', 'required', 'status', 'tries', 'first_try', 'hints', 'minutes', 'class_median_minutes'],
    r.modules.flatMap((m) => m.lessons.flatMap((l) => l.activities.map((a) => [
      m.title, l.title, a.title, a.kind, a.required ? 'yes' : 'no', a.state, a.attempts,
      a.firstTryCorrect === null ? null : a.firstTryCorrect ? 'right' : 'wrong', a.hints,
      Math.round(a.timeSpentS / 60), a.classMedianTimeS === null ? null : Math.round(a.classMedianTimeS / 60),
    ]))),
  )
}
