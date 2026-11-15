import { describe, expect, it } from 'vitest'
import { buildGrid, countsPerActivity, initials } from '../live'

const acts = ['a1', 'a2', 'a3'].map((id, i) => ({ id, title: `Step ${i + 1}`, kind: 'reading', module: 'M', lesson: 'L' }))
const students = [{ id: 's1', name: 'Maya Rivera' }, { id: 's2', name: 'Sam P.' }, { id: 's3', name: 'Ava' }]
const progress = [
  { student_id: 's1', activity_id: 'a1', status: 'completed' as const, updated_at: '2026-11-15T10:00:00Z' },
  { student_id: 's1', activity_id: 'a2', status: 'in_progress' as const, updated_at: '2026-11-15T10:05:00Z' },
  { student_id: 's2', activity_id: 'a1', status: 'in_progress' as const, updated_at: '2026-11-15T10:01:00Z' },
]
const stuck = [{ student_id: 's2', activity_id: 'a1', reasons: ['wrong_attempts'] }]

describe('initials', () => {
  it.each([['Maya Rivera', 'M. R.'], ['Sam P.', 'S. P.'], ['  ava  ', 'A.'], ['', '?']])('%s -> %s', (n, out) => expect(initials(n)).toBe(out))
})

describe('buildGrid', () => {
  it('marks each cell done, working, stuck or not started, in activity order', () => {
    const [maya, sam, ava] = buildGrid(acts, students, progress, stuck)
    expect(maya!.cells).toEqual(['done', 'working', 'not_started'])
    expect(sam!.cells).toEqual(['stuck', 'not_started', 'not_started'])
    expect(ava!.cells).toEqual(['not_started', 'not_started', 'not_started'])
  })

  it('knows what each student touched last and how many they finished', () => {
    const [maya, sam, ava] = buildGrid(acts, students, progress, stuck)
    expect(maya).toMatchObject({ currentTitle: 'Step 2', done: 1, stuck: false })
    expect(sam).toMatchObject({ currentTitle: 'Step 1', done: 0, stuck: true })
    expect(ava!.currentTitle).toBeNull()
  })

  it('flags a student stuck for being idle even with no activity named', () => {
    const [, , ava] = buildGrid(acts, students, progress, [{ student_id: 's3', activity_id: null, reasons: ['inactive'] }])
    expect(ava!.stuck).toBe(true)
    expect(ava!.cells).toEqual(['not_started', 'not_started', 'not_started'])
  })
})

describe('countsPerActivity', () => {
  it('counts who is on each step and who is past it', () => {
    const rows = buildGrid(acts, students, progress, stuck)
    expect(countsPerActivity(rows, acts).map((c) => [c.working, c.done])).toEqual([[1, 1], [1, 0], [0, 0]])
  })
})
