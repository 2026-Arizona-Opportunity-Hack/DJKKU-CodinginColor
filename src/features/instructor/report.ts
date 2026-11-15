// Pure logic for the funder impact report: turns class-level learning-gain rows (v_learning_gain,
// scope 'class') into a report per module, a headline sentence and a CSV. Class aggregates only:
// no student appears anywhere in the report, so it is safe to hand to a funder.
import { toCsv } from '@shared/authoring/csv'
import { round1 } from '@shared/authoring/gain'

export interface GainRow {
  module_id: string
  concept_id: string | null
  pre_pct: number | null
  post_pct: number | null
  gain_points: number | null
  normalized_gain: number | null
  complete_count: number
  incomplete_count: number
}

export interface GainLine {
  /** null for the module as a whole. */
  conceptId: string | null
  label: string
  pre: number | null
  post: number | null
  gain: number | null
  normalizedGain: number | null
  measured: number
  incomplete: number
}

export interface ModuleReport {
  moduleId: string
  title: string
  overall: GainLine | null
  concepts: GainLine[]
  headline: string
  /** Fewer than 5 students with both tests: shown, but flagged. */
  smallGroup: boolean
}

/** Groups under this are hidden by the read API; the report shows them with a warning. */
export const SMALL_GROUP = 5

const line = (r: GainRow, label: string): GainLine => ({
  conceptId: r.concept_id,
  label,
  pre: round1(r.pre_pct),
  post: round1(r.post_pct),
  gain: round1(r.gain_points),
  normalizedGain: r.normalized_gain === null ? null : Math.round(r.normalized_gain * 100) / 100,
  measured: r.complete_count,
  incomplete: r.incomplete_count,
})

const points = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)} point${Math.abs(Math.round(n)) === 1 ? '' : 's'}`

/** One plain sentence a funder can quote, or an honest note when there is nothing to measure yet. */
export function headline(className: string, overall: GainLine | null, concepts: GainLine[]): string {
  if (!overall || overall.gain === null || overall.measured === 0) {
    return `No student in ${className} has taken both the pre-test and the post-test yet, so there is no learning gain to report.`
  }
  const best = [...concepts].filter((c) => c.gain !== null).sort((a, b) => b.gain! - a.gain!)[0]
  const who = `${overall.measured} student${overall.measured === 1 ? '' : 's'} in ${className}`
  const main = `${who} went from ${Math.round(overall.pre!)}% on the pre-test to ${Math.round(overall.post!)}% on the post-test (${points(overall.gain)}).`
  return best && best.gain! > 0 ? `${main} The biggest gain was in ${best.label}: ${points(best.gain!)}.` : main
}

export function buildReport(
  className: string,
  rows: GainRow[],
  moduleTitles: Map<string, string>,
  conceptNames: Map<string, string>,
): ModuleReport[] {
  const byModule = new Map<string, GainRow[]>()
  for (const r of rows) byModule.set(r.module_id, [...(byModule.get(r.module_id) ?? []), r])
  return [...byModule.entries()]
    .map(([moduleId, list]) => {
      const o = list.find((r) => r.concept_id === null)
      const overall = o ? line(o, 'Whole module') : null
      const concepts = list
        .filter((r) => r.concept_id !== null)
        .map((r) => line(r, conceptNames.get(r.concept_id!) ?? r.concept_id!))
        .sort((a, b) => a.label.localeCompare(b.label))
      return {
        moduleId,
        title: moduleTitles.get(moduleId) ?? 'Module',
        overall,
        concepts,
        headline: headline(className, overall, concepts),
        smallGroup: (overall?.measured ?? 0) < SMALL_GROUP,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** The report as a spreadsheet: one row for the module, one per concept. Aggregates only. */
export function reportCsv(className: string, m: ModuleReport): string {
  const lines = [...(m.overall ? [m.overall] : []), ...m.concepts]
  return toCsv(
    ['class', 'module', 'concept', 'pre_pct', 'post_pct', 'gain_points', 'normalized_gain', 'students_measured', 'students_incomplete'],
    lines.map((l) => [className, m.title, l.conceptId === null ? 'all concepts' : l.label, l.pre, l.post, l.gain, l.normalizedGain, l.measured, l.incomplete]),
  )
}
