import type { ClassGainRow, ClassProgressRow } from './source'
import {
  MIN_GROUP_SIZE,
  type CompletionRow,
  type GroupBy,
  type LearningGainRow,
} from './types'

// Turns the database's class-level rows into the API's rows. A cohort is built only
// from the classes that are visible (5+ students), so a hidden class never feeds any
// total and cannot be worked out by subtracting one row from another.

/** School plus term, for example "Maryvale 2026 Fall". The open class has no school. */
export function cohortLabel(row: {
  school_name: string | null
  term: string | null
  class_name: string
}): string {
  if (!row.school_name) return row.class_name
  return row.term ? `${row.school_name} ${row.term}` : row.school_name
}

function round(n: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}

function matchesCohort(label: string, wanted: string | undefined): boolean {
  return !wanted || label.toLowerCase() === wanted.toLowerCase()
}

function byLabels(
  a: { cohort: string; class: string | null },
  b: { cohort: string; class: string | null },
): number {
  return a.cohort.localeCompare(b.cohort) || (a.class ?? '').localeCompare(b.class ?? '')
}

export function buildCompletion(
  rows: ClassProgressRow[],
  groupBy: GroupBy,
  cohort?: string,
): CompletionRow[] {
  const visible = rows.filter(
    (r) => r.students >= MIN_GROUP_SIZE && matchesCohort(cohortLabel(r), cohort),
  )

  if (groupBy === 'class') {
    return visible
      .map((r) => ({
        cohort: cohortLabel(r),
        class: r.class_name,
        students: r.students,
        avg_completion_pct: round(r.avg_completion_pct, 2),
      }))
      .sort(byLabels)
  }

  // Cohort: add up students and weight each class's average by its size.
  const cohorts = new Map<string, { students: number; weighted: number }>()
  for (const r of visible) {
    const label = cohortLabel(r)
    const acc = cohorts.get(label) ?? { students: 0, weighted: 0 }
    acc.students += r.students
    acc.weighted += r.avg_completion_pct * r.students
    cohorts.set(label, acc)
  }
  return [...cohorts]
    .map(([label, acc]) => ({
      cohort: label,
      class: null,
      students: acc.students,
      avg_completion_pct: round(acc.weighted / acc.students, 2),
    }))
    .sort(byLabels)
}

interface GainAcc {
  cohort: string
  class: string | null
  module: string
  concept: string | null
  complete: number
  incomplete: number
  preSum: number
  postSum: number
}

export function buildLearningGain(
  rows: ClassGainRow[],
  groupBy: GroupBy,
  cohort?: string,
): LearningGainRow[] {
  const groups = new Map<string, GainAcc>()
  for (const r of rows) {
    const label = cohortLabel(r)
    if (
      r.complete_count < MIN_GROUP_SIZE ||
      r.pre_pct === null ||
      r.post_pct === null ||
      !matchesCohort(label, cohort)
    ) {
      continue
    }
    const key = JSON.stringify([groupBy === 'class' ? r.class_id : label, r.module_id, r.concept_id])
    const acc: GainAcc = groups.get(key) ?? {
      cohort: label,
      class: groupBy === 'class' ? r.class_name : null,
      module: r.module_title,
      concept: r.concept_name,
      complete: 0,
      incomplete: 0,
      preSum: 0,
      postSum: 0,
    }
    // Class means weighted by how many students stand behind them give the true mean
    // across all those students.
    acc.complete += r.complete_count
    acc.incomplete += r.incomplete_count
    acc.preSum += r.pre_pct * r.complete_count
    acc.postSum += r.post_pct * r.complete_count
    groups.set(key, acc)
  }

  return [...groups.values()]
    .filter((g) => g.complete >= MIN_GROUP_SIZE)
    .map((g) => {
      const pre = g.preSum / g.complete
      const post = g.postSum / g.complete
      return {
        cohort: g.cohort,
        class: g.class,
        module: g.module,
        concept: g.concept,
        complete_count: g.complete,
        incomplete_count: g.incomplete,
        pre_pct: round(pre, 2),
        post_pct: round(post, 2),
        gain_points: round(post - pre, 2),
        // Hake's method, as in ADR 0020: from the pooled means, null when pre is 100.
        normalized_gain: pre >= 100 ? null : round((post - pre) / (100 - pre), 3),
      }
    })
    .sort(
      (a, b) =>
        byLabels(a, b) ||
        a.module.localeCompare(b.module) ||
        (a.concept ?? '').localeCompare(b.concept ?? ''),
    )
}
