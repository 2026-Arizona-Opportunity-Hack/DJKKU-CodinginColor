// Pure logic for the live class view: who is on which activity right now. No React, no fetching.

export interface LiveActivity { id: string; title: string; kind: string; module: string; lesson: string }
export interface LiveStudent { id: string; name: string }
export interface LiveProgress { student_id: string; activity_id: string; status: 'in_progress' | 'completed'; updated_at: string }
export interface LiveStuck { student_id: string; activity_id: string | null; reasons: string[] }

export type CellState = 'done' | 'working' | 'stuck' | 'not_started'
export const CELL_LABEL: Record<CellState, string> = { done: 'Done', working: 'Working', stuck: 'Stuck', not_started: 'Not started' }

export interface LiveRow {
  student: LiveStudent
  cells: CellState[]
  /** The activity they touched most recently, if any. */
  currentTitle: string | null
  done: number
  stuck: boolean
}

/** "Maya R." -> "M. R." so a projected screen does not single anyone out by name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts.map((p) => `${p[0]!.toUpperCase()}.`).join(' ') : '?'
}

export function buildGrid(activities: LiveActivity[], students: LiveStudent[], progress: LiveProgress[], stuck: LiveStuck[]): LiveRow[] {
  const byStudent = new Map<string, LiveProgress[]>()
  for (const p of progress) byStudent.set(p.student_id, [...(byStudent.get(p.student_id) ?? []), p])
  const stuckAt = new Map(stuck.map((s) => [s.student_id, s.activity_id]))
  return students.map((student) => {
    const mine = byStudent.get(student.id) ?? []
    const status = new Map(mine.map((p) => [p.activity_id, p.status]))
    const stuckActivity = stuckAt.get(student.id)
    const cells = activities.map((a): CellState => {
      if (stuckAt.has(student.id) && stuckActivity === a.id) return 'stuck'
      const s = status.get(a.id)
      return s === 'completed' ? 'done' : s === 'in_progress' ? 'working' : 'not_started'
    })
    const latest = [...mine].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    return {
      student,
      cells,
      currentTitle: latest ? (activities.find((a) => a.id === latest.activity_id)?.title ?? null) : null,
      done: cells.filter((c) => c === 'done').length,
      stuck: stuckAt.has(student.id),
    }
  })
}

/** How many students are on each activity (working or stuck there), for the "where is everyone" strip. */
export function countsPerActivity(rows: LiveRow[], activities: LiveActivity[]) {
  return activities.map((a, i) => ({
    activity: a,
    working: rows.filter((r) => r.cells[i] === 'working' || r.cells[i] === 'stuck').length,
    done: rows.filter((r) => r.cells[i] === 'done').length,
  }))
}
