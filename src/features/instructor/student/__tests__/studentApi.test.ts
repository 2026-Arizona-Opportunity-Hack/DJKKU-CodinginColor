import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allowRetake, loadStudent, resetLoginCode } from '../studentApi'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const CLASS = '10000000-0000-4000-8000-00000000000a'
const SEAT = '20000000-0000-4000-8000-000000000001'
const STUDENT = '30000000-0000-4000-8000-000000000001'

type Call = { table: string; select: string; eq: [string, unknown][]; or: string[] }

/** A stand-in client: records every table read with its filters; answers with canned rows per table. */
function fake(tables: Record<string, unknown[] | ((c: Call) => unknown[])>, rpcAnswer: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = []
  const rpc = vi.fn(async () => ({ data: null, error: null, ...rpcAnswer }))
  const from = vi.fn((table: string) => {
    const call: Call = { table, select: '', eq: [], or: [] }
    calls.push(call)
    const data = () => { const t = tables[table]; return typeof t === 'function' ? t(call) : (t ?? []) }
    const b: Record<string, unknown> = {}
    b.select = (s: string) => ((call.select = s), b)
    b.eq = (c: string, v: unknown) => (call.eq.push([c, v]), b)
    b.or = (s: string) => (call.or.push(s), b)
    b.order = () => b
    b.limit = () => b
    b.maybeSingle = async () => ({ data: (data() as unknown[])[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: data(), error: null }).then(ok)
    return b
  })
  h.sb = { from, rpc }
  return { calls, rpc, from }
}

const MEMBER = { id: SEAT, display_name: 'Ava K.', profile_id: STUDENT, claimed_at: '2026-11-03T12:00:00Z' }
const BASE = {
  class_members: [MEMBER],
  classes: [{ name: 'Period 1', term: 'Fall 2026' }],
  concepts: [{ id: 'loops', name: 'Loops' }],
  class_modules: [{ position: 0, modules: { id: 'm1', title: 'Variables and Loops', lessons: [{ id: 'l1', position: 0, title: 'Loops', activities: [
    { id: 'a1', position: 0, kind: 'check', title: 'Loops check', required: true, concept_id: 'loops', content: { questions: [] } },
  ] }], assessments: [] } }],
  submissions: [{ activity_id: 'a1', response: { answers: {} }, is_correct: false, results: 'not an object', attempt_no: 1, submitted_at: '2026-11-10T12:00:00Z' }],
}

beforeEach(() => vi.clearAllMocks())

describe('loadStudent', () => {
  it('refuses ids that are not uuids, before touching the database', async () => {
    const { from } = fake(BASE)
    await expect(loadStudent('nope', SEAT)).rejects.toMatchObject({ code: 'not_found' })
    await expect(loadStudent(CLASS, 'x,profile_id.neq.0')).rejects.toMatchObject({ code: 'not_found' })
    expect(from).not.toHaveBeenCalled()
  })

  it('finds the student by seat id or profile id, only among this class\'s students', async () => {
    const { calls } = fake(BASE)
    await loadStudent(CLASS, SEAT)
    const member = calls.find((c) => c.table === 'class_members')!
    expect(member.eq).toEqual([['class_id', CLASS], ['member_role', 'student']])
    expect(member.or).toEqual([`id.eq.${SEAT},profile_id.eq.${SEAT}`])
  })

  it('says not found when the student is not in this class', async () => {
    fake({ ...BASE, class_members: [] })
    await expect(loadStudent(CLASS, SEAT)).rejects.toThrow('That student was not found in this class.')
  })

  it('reads only class-scoped data, and per-student tables only for this student', async () => {
    const { calls } = fake(BASE)
    await loadStudent(CLASS, SEAT)
    const tables = [...new Set(calls.map((c) => c.table))].sort()
    expect(tables).toEqual([
      'assessment_responses', 'assessment_results', 'class_members', 'class_modules', 'classes', 'concepts', 'hint_events',
      'progress', 'submissions', 'v_class_progress', 'v_concept_mastery', 'v_learning_gain', 'v_stuck',
    ])
    for (const c of calls) {
      if (c.table === 'concepts') continue
      if (c.table === 'classes') { expect(c.eq).toContainEqual(['id', CLASS]); continue }
      expect(c.eq).toContainEqual(['class_id', CLASS])
    }
    for (const t of ['submissions', 'assessment_results', 'assessment_responses', 'hint_events', 'v_stuck']) {
      expect(calls.find((c) => c.table === t)!.eq).toContainEqual(['student_id', STUDENT])
    }
    const gain = calls.filter((c) => c.table === 'v_learning_gain')
    expect(gain.map((c) => c.eq)).toEqual([
      [['class_id', CLASS], ['scope', 'student'], ['student_id', STUDENT]],
      [['class_id', CLASS], ['scope', 'class']],
    ])
  })

  it('maps rows into the report input, and treats unreadable grading results as empty', async () => {
    fake(BASE)
    const { input, memberId, profileId } = await loadStudent(CLASS, SEAT)
    expect({ memberId, profileId }).toEqual({ memberId: SEAT, profileId: STUDENT })
    expect(input.className).toBe('Period 1 (Fall 2026)')
    expect(input.modules[0].lessons[0].activities[0]).toMatchObject({ id: 'a1', kind: 'check', conceptId: 'loops' })
    expect(input.submissions[0]).toMatchObject({ activityId: 'a1', isCorrect: false, results: {}, attemptNo: 1 })
  })

  it('does not read any per-student table for a seat nobody has claimed', async () => {
    const { calls } = fake({ ...BASE, class_members: [{ ...MEMBER, profile_id: null, claimed_at: null }] })
    const { input } = await loadStudent(CLASS, SEAT)
    const tables = new Set(calls.map((c) => c.table))
    for (const t of ['submissions', 'assessment_results', 'assessment_responses', 'hint_events', 'v_stuck', 'v_learning_gain']) expect(tables.has(t)).toBe(false)
    expect(input.member.profileId).toBeNull()
    expect(input.submissions).toEqual([])
  })
})

describe('actions', () => {
  it('resets a login code through the database function', async () => {
    const { rpc } = fake(BASE, { data: { login_code: 'ABCD-EFGH-JKLM-NPQR' } })
    await expect(resetLoginCode(SEAT)).resolves.toBe('ABCD-EFGH-JKLM-NPQR')
    expect(rpc).toHaveBeenCalledWith('reset_login_code', { p_member_id: SEAT })
  })

  it('allows a retake through the database function', async () => {
    const { rpc } = fake(BASE)
    await allowRetake(STUDENT, CLASS, 't1')
    expect(rpc).toHaveBeenCalledWith('reset_assessment_result', { p_student_id: STUDENT, p_class_id: CLASS, p_assessment_id: 't1' })
  })

  it('passes the database message through when it refuses', async () => {
    fake(BASE, { error: { code: 'P0001', message: 'Not allowed to reset this code' } })
    await expect(resetLoginCode(SEAT)).rejects.toThrow('Not allowed to reset this code')
  })
})
