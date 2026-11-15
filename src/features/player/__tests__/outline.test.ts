import { describe, expect, it } from 'vitest'

import { needsPretest, nextStep, overallTally } from '../outline'
import type { ClassOutline, ItemStatus, OutlineModule } from '../types'

const act = (id: string, status: ItemStatus) => ({ activity_id: id, title: id, kind: 'video' as const, position: 1, required: true, status })
const mod = (n: number, pre: ItemStatus, acts: [string, ItemStatus][], post: ItemStatus): OutlineModule => ({
  module_id: `m${n}`,
  title: `Module ${n}`,
  position: n,
  pretest: { assessment_id: `pre${n}`, status: pre },
  posttest: { assessment_id: `post${n}`, status: post },
  lessons: [{ lesson_id: `l${n}`, title: `Lesson ${n}`, position: 1, activities: acts.map(([id, s]) => act(id, s)) }],
})
const outline = (...modules: OutlineModule[]): ClassOutline => ({ modules })
const next = (activity_id: string, module_id = 'm1') => ({ module_id, lesson_id: 'l1', activity_id })

describe('nextStep', () => {
  it('null next with an available pre-test is the pre-test, not "done" (a brand-new student)', () => {
    const o = outline(mod(1, 'available', [['a1', 'locked']], 'locked'))
    expect(nextStep(o, null)).toMatchObject({ kind: 'pretest', assessment_id: 'pre1', module: { title: 'Module 1' } })
  })

  it('an available next activity is the activity, with its module and lesson', () => {
    const o = outline(mod(1, 'done', [['a1', 'done'], ['a2', 'available']], 'locked'))
    expect(nextStep(o, next('a2'))).toMatchObject({ kind: 'activity', module: { title: 'Module 1' }, lesson: { title: 'Lesson 1' }, activity: { activity_id: 'a2' } })
  })

  it('null next with everything done but an available post-test is the post-test', () => {
    const o = outline(mod(1, 'done', [['a1', 'done']], 'available'))
    expect(nextStep(o, null)).toMatchObject({ kind: 'posttest', assessment_id: 'post1' })
  })

  it('null next with nothing left is done', () => {
    const o = outline(mod(1, 'done', [['a1', 'done']], 'done'), mod(2, 'done', [['b1', 'done']], 'done'))
    expect(nextStep(o, null)).toEqual({ kind: 'done' })
    expect(nextStep(outline(), null)).toEqual({ kind: 'done' })
  })

  it('walks modules in order: the first available pre-test wins, then activities, then post-tests', () => {
    const o = outline(mod(1, 'done', [['a1', 'done']], 'done'), mod(2, 'available', [['b1', 'locked']], 'locked'))
    expect(nextStep(o, null)).toMatchObject({ kind: 'pretest', assessment_id: 'pre2' })
  })

  it('a pre-test in a LATER module does not jump ahead of an available activity (the open class is not chained)', () => {
    const o = outline(mod(1, 'done', [['a1', 'available']], 'locked'), mod(2, 'available', [['b1', 'locked']], 'locked'))
    expect(nextStep(o, next('a1'))).toMatchObject({ kind: 'activity', activity: { activity_id: 'a1' } })
  })

  it('a pre-test in the same module still comes before its activity (the gate)', () => {
    const o = outline(mod(1, 'available', [['a1', 'available']], 'locked'))
    expect(nextStep(o, next('a1'))).toMatchObject({ kind: 'pretest' })
  })

  it('ignores a next activity the outline does not know, and falls through to the post-test', () => {
    const o = outline(mod(1, 'done', [['a1', 'done']], 'available'))
    expect(nextStep(o, next('ghost'))).toMatchObject({ kind: 'posttest' })
  })
})

describe('a late joiner placed at module 2 (module 1 skipped)', () => {
  const placed = outline(
    mod(1, 'skipped', [['a1', 'skipped'], ['a2', 'skipped']], 'skipped'),
    mod(2, 'available', [['b1', 'locked']], 'locked'),
  )

  it('starts at the module 2 pre-test, never at skipped work', () => {
    expect(nextStep(placed, null)).toMatchObject({ kind: 'pretest', assessment_id: 'pre2', module: { title: 'Module 2' } })
  })

  it('a skipped module owes no pre-test', () => {
    expect(needsPretest(placed.modules[0]!)).toBe(false)
    expect(needsPretest(placed.modules[1]!)).toBe(true)
  })

  it('progress counts skipped work as neither done nor missing', () => {
    expect(overallTally(placed)).toEqual({ done: 0, total: 1, pct: 0 })
    const later = outline(mod(1, 'skipped', [['a1', 'skipped']], 'skipped'), mod(2, 'done', [['b1', 'done']], 'available'))
    expect(overallTally(later)).toEqual({ done: 1, total: 1, pct: 100 })
  })
})
