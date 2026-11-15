// Database tests for lane A, run against a REAL local Supabase (`npx supabase start`,
// then `npx supabase db reset` so the seed is loaded). Every test runs in a transaction that
// is rolled back, so tests never leave data behind and can run in any order.
//
// Users are simulated the way PostgREST does it: switch to the `authenticated` (or `anon`)
// role and set the JWT claims, so auth.uid() and row-level security behave exactly as in
// production. If no database is reachable the suite is skipped, unless REQUIRE_DB=1 (CI).
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const client = new pg.Client({ connectionString: url })
let up = false
try {
  await client.connect()
  up = true
} catch (e) {
  if (process.env.REQUIRE_DB) throw e
  console.warn('[db tests] no database at', url, '- skipping. Run `npx supabase start` and `npx supabase db reset`.')
}

const MODULE = '20000000-0000-4000-8000-000000000001'
const OPEN_CLASS = '10000000-0000-4000-8000-000000000001'
const P1 = '11000000-0000-4000-8000-000000000001'
const ACT = (n: number) => `50000000-0000-4000-8000-00000000000${n}`
const PRE = '60000000-0000-4000-8000-000000000001'
const POST = '60000000-0000-4000-8000-000000000002'
const SEED_STUDENT_1 = 'b0000000-0000-4000-8000-000000000001'
const SEED_STUDENT_2 = 'b0000000-0000-4000-8000-000000000002'

type Row = Record<string, unknown>
const q = async <T = Row>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[]
const one = async <T = unknown>(sql: string, params: unknown[] = []) => (await q<{ r: T }>(sql, params))[0]!.r

/** Run as a user (or as anon with uid null). RLS and auth.uid() behave as in production. */
async function as(uid: string | null) {
  await client.query('reset role')
  await client.query(`set local role ${uid ? 'authenticated' : 'anon'}`)
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' })])
}
const asSuper = () => client.query('reset role')

/** Expect a statement to fail with a message matching `pattern`, without poisoning the transaction. */
async function fails(sql: string, params: unknown[], pattern: RegExp) {
  await client.query('savepoint s')
  try {
    await client.query(sql, params)
  } catch (e) {
    await client.query('rollback to savepoint s')
    expect((e as Error).message).toMatch(pattern)
    return
  }
  await client.query('rollback to savepoint s')
  throw new Error(`expected failure matching ${pattern} but the statement succeeded: ${sql}`)
}

async function mkUser(role = 'student', opts: { author?: boolean; email?: string } = {}) {
  const id = randomUUID()
  await asSuper()
  await client.query(
    `insert into auth.users (id, aud, role, email, email_confirmed_at, is_anonymous) values ($1, 'authenticated', 'authenticated', $2, now(), $3)`,
    [id, opts.email ?? null, !opts.email],
  )
  await client.query('update public.profiles set role = $2, can_author = $3 where id = $1', [id, role, opts.author ?? false])
  return id
}

/** A correct response built from an answer key (what a good student would send). */
function good(key: Row, wrong = false): Row {
  if (key.type === 'mcq') return { choice_id: wrong ? 'zz' : key.correctChoiceId }
  if (key.type === 'short_answer') return { text: wrong ? 'nope' : (key.accepted as string[])[0] }
  if (key.type === 'fill_blank') return { blanks: wrong ? ['x'] : (key.blanks as string[][]).map((b) => b[0]) }
  return { order: wrong ? [...(key.correctOrder as string[])].reverse() : key.correctOrder }
}
async function keysFor(activityId: string) {
  await asSuper()
  return Object.fromEntries((await q<{ question_id: string; key: Row }>('select question_id, key from activity_keys where activity_id = $1', [activityId])).map((k) => [k.question_id, k.key]))
}
async function testAnswers(assessmentId: string, wrongOnly: string[] = []) {
  await asSuper()
  const rows = await q<{ question_id: string; key: Row }>(
    'select i.question_id, k.key from assessment_items i join assessment_keys k on k.assessment_item_id = i.id where i.assessment_id = $1', [assessmentId])
  return Object.fromEntries(rows.map((r) => [r.question_id, good(r.key, wrongOnly.includes(r.question_id))]))
}

beforeAll(() => {})
afterAll(async () => { if (up) await client.end() })
beforeEach(async () => { if (up) await client.query('begin') })
afterEach(async () => { if (up) await client.query('rollback') })

describe.skipIf(!up)('answer keys and sensitive columns', () => {
  it('no client role can read any key table, hash column or cache', async () => {
    const student = await mkUser()
    for (const who of [null, student]) {
      await as(who)
      for (const sql of [
        'select * from activity_keys', 'select * from assessment_keys', 'select * from hint_cache',
        'select * from member_login_codes', 'select * from class_join_codes', 'select * from api_key_secrets',
      ]) await fails(sql, [], /permission denied/)
    }
  })

  it('student-visible content carries no key fields anywhere', async () => {
    await as(null)
    const content = await q<{ t: string }>(`select content::text as t from activities union all select content::text from assessment_items`)
    expect(content.length).toBeGreaterThan(10)
    for (const c of content) expect(c.t).not.toMatch(/"(correctChoiceId|correctOrder|accepted|caseSensitive|hints|explanation)"\s*:/)
  })

  it('the database refuses content that smuggles a key in', async () => {
    const author = await mkUser('instructor', { author: true })
    await as(author)
    const bad = {
      slug: 'leaky', title: 'Leaky', lessons: [{ title: 'L', activities: [{
        kind: 'check', title: 'C', content: { questions: [{ id: 'q1', type: 'mcq', prompt: 'p', conceptId: 'loops', correctChoiceId: 'a', choices: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }] }] }, keys: [] }] }],
    }
    await fails('select public.save_module_draft($1::jsonb)', [JSON.stringify(bad)], /activities_content_no_keys/)
  })
})

describe.skipIf(!up)('roles and direct table access', () => {
  it('a student sees only their own progress and roster row', async () => {
    await as(SEED_STUDENT_1)
    expect((await q<{ student_id: string }>('select distinct student_id from progress')).map((r) => r.student_id)).toEqual([SEED_STUDENT_1])
    expect((await q('select * from class_members')).length).toBe(1)
    expect((await q('select * from submissions where student_id = $1', [SEED_STUDENT_2])).length).toBe(0)
  })

  it('a student cannot change their own role or write curriculum', async () => {
    await as(SEED_STUDENT_1)
    await fails(`update profiles set role = 'cic_admin' where id = $1`, [SEED_STUDENT_1], /permission denied/)
    await fails(`update profiles set can_author = true where id = $1`, [SEED_STUDENT_1], /permission denied/)
    await fails(`insert into modules (slug, title) values ('x','x')`, [], /permission denied/)
    await fails(`update lessons set title = 'x'`, [], /permission denied/)
    await fails(`delete from progress`, [], /permission denied/)
    await fails(`insert into progress (student_id, class_id, activity_id, status, completed_at) values ($1,$2,$3,'completed',now())`, [SEED_STUDENT_1, P1, ACT(7)], /permission denied/)
  })

  it('a student can rename themselves', async () => {
    await as(SEED_STUDENT_1)
    await q(`update profiles set display_name = 'Ava Q.' where id = $1`, [SEED_STUDENT_1])
    expect((await q<{ display_name: string }>('select display_name from profiles where id = $1', [SEED_STUDENT_1]))[0]!.display_name).toBe('Ava Q.')
  })

  it('students cannot call staff functions', async () => {
    await as(SEED_STUDENT_1)
    for (const sql of [
      `select public.publish_module('${MODULE}')`, `select public.create_api_key('k', '{}')`,
      `select public.import_roster('${P1}', '["Z"]'::jsonb)`, `select public.invite_staff('a@b.co','reviewer')`,
      `select public.get_activity_keys('${ACT(3)}')`, `select public.save_module_draft('{}'::jsonb)`,
    ]) await fails(sql, [], /(Only|Not allowed|not allowed)/)
  })

  it('internal helpers are not callable by clients', async () => {
    await as(SEED_STUDENT_1)
    await fails(`select public._activity_flow('${SEED_STUDENT_2}', '${P1}')`, [], /permission denied/)
    await fails(`select public.grade_question('mcq', '{}', '{}')`, [], /permission denied/)
    await fails(`select * from public._gain_core`, [], /permission denied/)
  })

  it('a reviewer reads published curriculum but no keys, and writes nothing', async () => {
    const reviewer = await mkUser('reviewer')
    await as(reviewer)
    expect((await q('select * from modules where status = $1', ['published'])).length).toBe(1)
    expect((await q('select * from activities')).length).toBeGreaterThan(0)
    expect((await q('select * from progress')).length).toBe(0)       // no student data
    expect((await q('select * from class_members')).length).toBe(0)
    await fails(`select public.get_activity_keys('${ACT(3)}')`, [], /Not allowed/)
    await fails(`update modules set title = 'x'`, [], /permission denied/)
    await fails(`select public.save_module_draft('{}'::jsonb)`, [], /not allowed to author/)
  })

  it('an unassigned mentor sees nothing; an assigned one sees only their mentee', async () => {
    const mentor = await mkUser('mentor')
    const admin = await mkUser('cic_admin')
    await as(mentor)
    expect((await q('select * from progress')).length).toBe(0)
    await as(admin)
    await q('select public.assign_mentor($1, $2)', [mentor, SEED_STUDENT_1])
    await as(mentor)
    expect((await q<{ student_id: string }>('select distinct student_id from progress')).map((r) => r.student_id)).toEqual([SEED_STUDENT_1])
    expect((await q('select * from v_stuck')).length).toBe(0)
  })

  it('an instructor sees only the classes they teach', async () => {
    const ins = await mkUser('instructor')
    await as(ins)
    expect((await q('select * from progress')).length).toBe(0)
    await asSuper()
    await q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'instructor', 'T')`, [P1, ins])
    await as(ins)
    const ids = (await q<{ class_id: string }>('select distinct class_id from progress')).map((r) => r.class_id)
    expect(ids).toEqual([P1])
    expect((await q('select * from class_members')).length).toBeGreaterThan(5)
  })

  it('invited staff get their role from a verified Google sign-in, and nobody else does', async () => {
    const admin = await mkUser('cic_admin')
    await as(admin)
    await q(`select public.invite_staff('Teacher@School.org', 'instructor', true)`)
    await asSuper()
    const g = randomUUID(), e = randomUUID()
    const ins = `insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data) values ($1,'authenticated','authenticated','teacher@school.org', $2, $3)`
    await client.query('savepoint signup')
    await client.query(ins, [e, null, JSON.stringify({ provider: 'email' })])                // unverified email sign-up
    expect((await q<{ role: string }>('select role from profiles where id = $1', [e]))[0]!.role).toBe('student')
    await client.query('rollback to savepoint signup')
    await client.query(ins, [e, new Date(), JSON.stringify({ provider: 'email' })])          // verified, but not through Google
    expect((await q<{ role: string }>('select role from profiles where id = $1', [e]))[0]!.role).toBe('student')
    await client.query('rollback to savepoint signup')
    await client.query(ins, [g, new Date(), JSON.stringify({ provider: 'google' })])         // verified Google
    const p = (await q<{ role: string; can_author: boolean }>('select role, can_author from profiles where id = $1', [g]))[0]!
    expect(p).toEqual({ role: 'instructor', can_author: true })
  })

  it('applies the invite when Google confirms the email after creating the account (the real order)', async () => {
    const admin = await mkUser('cic_admin')
    await as(admin)
    await q(`select public.invite_staff('late.confirm@school.org', 'cic_admin', false)`)
    await q(`select public.invite_staff('kept@school.org', 'instructor', false)`)
    await asSuper()
    const ins = `insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data) values ($1,'authenticated','authenticated',$2, null, $3)`
    const roleOf = async (id: string) => (await q<{ role: string }>('select role from profiles where id = $1', [id]))[0]!.role

    // Google: created unconfirmed (a student for now), then confirmed -> the invited role.
    const g = randomUUID()
    await client.query(ins, [g, 'late.confirm@school.org', JSON.stringify({ provider: 'google' })])
    expect(await roleOf(g)).toBe('student')
    await client.query('update auth.users set email_confirmed_at = now() where id = $1', [g])
    expect(await roleOf(g)).toBe('cic_admin')
    expect((await q<{ accepted: boolean }>(`select accepted_at is not null as accepted from staff_invites where email = 'late.confirm@school.org'`))[0]!.accepted).toBe(true)

    // An email (not Google) account confirmed later stays a student.
    const e = randomUUID()
    await client.query('savepoint other')
    await client.query(ins, [e, 'kept@school.org', JSON.stringify({ provider: 'email' })])
    await client.query('update auth.users set email_confirmed_at = now() where id = $1', [e])
    expect(await roleOf(e)).toBe('student')
    await client.query('rollback to savepoint other')

    // A role an admin already changed by hand is never overwritten.
    const k = randomUUID()
    await client.query(ins, [k, 'kept@school.org', JSON.stringify({ provider: 'google' })])
    await client.query(`update profiles set role = 'reviewer' where id = $1`, [k])
    await client.query('update auth.users set email_confirmed_at = now() where id = $1', [k])
    expect(await roleOf(k)).toBe('reviewer')
  })

  it('an admin cannot change their own role (no lockout)', async () => {
    const admin = await mkUser('cic_admin')
    await as(admin)
    await fails(`select public.set_profile_role($1, 'student')`, [admin], /cannot change your own role/)
  })
})

describe.skipIf(!up)('removing staff and cancelling invites', () => {
  const P3 = '11000000-0000-4000-8000-000000000002'
  const teach = (classId: string, who: string) =>
    q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'instructor', 'T')`, [classId, who])

  it('takes access away but keeps the account, and warns about classes left without an instructor', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor', { author: true, email: 'leaving@school.org' })
    const other = await mkUser('instructor')
    await asSuper()
    await teach(P1, ins) // only instructor of Period 1
    await teach(P3, ins)
    await teach(P3, other) // Period 3 still has someone
    await q(`insert into staff_invites (email, role, accepted_at) values ('leaving@school.org', 'instructor', now())`)
    await as(admin)
    const preview = await one<{ classes_left_without_instructor: { id: string }[] }>('select public.remove_staff($1, true) as r', [ins])
    expect(preview.classes_left_without_instructor.map((c) => c.id)).toEqual([P1])
    await asSuper()
    expect((await q(`select 1 from class_members where profile_id = $1`, [ins])).length).toBe(2) // a dry run changes nothing

    await as(admin)
    await q('select public.remove_staff($1)', [ins])
    await asSuper()
    expect((await q<{ role: string; can_author: boolean }>('select role, can_author from profiles where id = $1', [ins]))[0]).toEqual({ role: 'student', can_author: false })
    expect((await q(`select 1 from class_members where profile_id = $1`, [ins])).length).toBe(0)
    expect((await q(`select 1 from class_members where profile_id = $1`, [other])).length).toBe(1)
    expect((await q(`select 1 from staff_invites where email = 'leaving@school.org'`)).length).toBe(0)
    expect((await q('select 1 from auth.users where id = $1', [ins])).length).toBe(1) // the account stays
    await as(ins)
    expect((await q('select * from progress')).length).toBe(0) // and sees nothing now
  })

  it('ends a removed mentor\'s assignments', async () => {
    const admin = await mkUser('cic_admin')
    const mentor = await mkUser('mentor')
    await as(admin)
    await q('select public.assign_mentor($1, $2)', [mentor, SEED_STUDENT_1])
    await q('select public.remove_staff($1)', [mentor])
    await asSuper()
    expect((await q<{ active: boolean }>('select active from mentor_assignments where mentor_id = $1', [mentor]))[0]!.active).toBe(false)
    await as(mentor)
    expect((await q('select * from progress')).length).toBe(0)
  })

  it('a re-invite gives the access back', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor', { email: 'back@school.org' })
    await asSuper()
    await q(`update auth.users set raw_app_meta_data = '{"provider":"google"}' where id = $1`, [ins])
    await as(admin)
    await q('select public.remove_staff($1)', [ins])
    await q(`select public.invite_staff('back@school.org', 'instructor', false)`)
    await asSuper()
    expect((await q<{ role: string }>('select role from profiles where id = $1', [ins]))[0]!.role).toBe('instructor')
  })

  it('refuses yourself, non-staff, non-admins and unknown people', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor')
    await as(admin)
    await fails('select public.remove_staff($1)', [admin], /cannot remove yourself/)
    await fails('select public.remove_staff($1)', [SEED_STUDENT_1], /not staff/)
    await fails('select public.remove_staff($1)', [randomUUID()], /not found/)
    await as(ins)
    await fails('select public.remove_staff($1)', [admin], /Only a CIC admin/)
    await as(SEED_STUDENT_1)
    await fails('select public.remove_staff($1)', [ins], /Only a CIC admin/)
  })

  it('cancels an unused invite only, and only for admins', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor')
    await as(admin)
    await q(`select public.invite_staff('Wrong.Email@School.org', 'instructor', false)`)
    await asSuper()
    await q(`insert into staff_invites (email, role, accepted_at) values ('joined@school.org', 'instructor', now())`)
    await as(ins)
    await fails(`select public.cancel_staff_invite('wrong.email@school.org')`, [], /Only a CIC admin/)
    await as(admin)
    await q(`select public.cancel_staff_invite(' WRONG.email@school.org ')`)
    await fails(`select public.cancel_staff_invite('joined@school.org')`, [], /no unused invite/)
    await asSuper()
    expect((await q(`select email from staff_invites where email in ('wrong.email@school.org', 'joined@school.org')`)).length).toBe(1)
  })
})

describe.skipIf(!up)('grading', () => {
  const g = (type: string, key: Row, resp: Row) => one<boolean>('select public.grade_question($1, $2::jsonb, $3::jsonb) as r', [type, JSON.stringify(key), JSON.stringify(resp)])
  it('short answers ignore case and extra spaces unless the key says caseSensitive', async () => {
    await asSuper()
    expect(await g('short_answer', { accepted: ['range', 'range()'] }, { text: '  RANGE ' })).toBe(true)
    expect(await g('short_answer', { accepted: ['range'] }, { text: 'ran ge' })).toBe(false)
    expect(await g('short_answer', { accepted: ['Paris'], caseSensitive: true }, { text: 'paris' })).toBe(false)
  })
  it('fill in the blank needs every blank right and the right count', async () => {
    await asSuper()
    const key = { blanks: [['for'], ['range', 'range()']] }
    expect(await g('fill_blank', key, { blanks: ['For', 'range()'] })).toBe(true)
    expect(await g('fill_blank', key, { blanks: ['for'] })).toBe(false)
    expect(await g('fill_blank', key, { blanks: ['for', 'len'] })).toBe(false)
  })
  it('ordering must match exactly; mcq must match the choice id', async () => {
    await asSuper()
    expect(await g('ordering', { correctOrder: ['a', 'b', 'c'] }, { order: ['a', 'b', 'c'] })).toBe(true)
    expect(await g('ordering', { correctOrder: ['a', 'b', 'c'] }, { order: ['a', 'c', 'b'] })).toBe(false)
    expect(await g('mcq', { correctChoiceId: 'b' }, { choice_id: 'b' })).toBe(true)
    expect(await g('mcq', { correctChoiceId: 'b' }, { choice_id: 'a' })).toBe(false)
  })
  it('malformed responses are simply wrong, never an error', async () => {
    await asSuper()
    for (const [t, k, r] of [
      ['mcq', { correctChoiceId: 'a' }, { choice_id: 5 }], ['short_answer', { accepted: ['x'] }, { text: ['x'] }],
      ['fill_blank', { blanks: [['x']] }, { blanks: 'x' }], ['ordering', { correctOrder: ['a', 'b'] }, {}], ['mcq', { correctChoiceId: 'a' }, []],
    ] as const) expect(await g(t, k as Row, r as unknown as Row)).toBe(false)
  })
})

describe.skipIf(!up)('the student journey, end to end', () => {
  /** An instructor with a new class and one claimed student, module assigned. */
  async function setup() {
    const ins = await mkUser('instructor')
    await as(ins)
    const { class_id } = await one<{ class_id: string }>(`select public.create_class('demo high school', 'Test class') as r`)
    const roster = await one<{ member_id: string; display_name: string; login_code: string }[]>(`select public.import_roster($1, '["Pat Q.","Sam R."]'::jsonb) as r`, [class_id])
    await q('select public.assign_module($1, $2)', [class_id, MODULE])
    const student = await mkUser()
    await as(student)
    const claimed = await one<{ class_id: string; class_name: string; display_name: string }>('select public.claim_login_code($1) as r', [roster[0]!.login_code])
    return { ins, class_id, roster, student, claimed }
  }
  const submit = (act: string, response: unknown, cls?: string) =>
    one<Row>('select public.submit_answer($1, $2::jsonb, $3) as r', [act, JSON.stringify(response), cls ?? null])
  const done = (act: string) => submit(act, { viewed: true })
  const answers = (keys: Record<string, Row>, wrongIds: string[] = []) => ({
    answers: Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, good(k, wrongIds.includes(id))])),
  })

  it('claiming a code binds the device to the class, and the code works once', async () => {
    const { claimed, roster, class_id } = await setup()
    expect(claimed).toEqual({ class_id, class_name: 'Test class', display_name: 'Pat Q.' })
    const other = await mkUser()
    await as(other)
    await fails('select public.claim_login_code($1)', [roster[0]!.login_code], /not valid/)
    await fails('select public.claim_login_code($1)', ['0000-0000-0000-0000'], /not valid/)
  })

  it('follows the unlock rules: pre-test first, strict order, post-test last', async () => {
    const { student, class_id, ins } = await setup()
    await as(student)

    // Before the pre-test every activity is locked, and the server refuses a submission.
    let outline = await one<{ modules: { pretest: { status: string }; posttest: { status: string }; lessons: { activities: { status: string; locked_reason?: string }[] }[] }[] }>('select public.get_class_outline($1) as r', [class_id])
    const mod = () => outline.modules[0]!
    expect(mod().pretest.status).toBe('available')
    expect(mod().posttest.status).toBe('locked')
    expect(mod().lessons[0]!.activities.every((a) => a.status === 'locked')).toBe(true)
    expect(mod().lessons[0]!.activities[0]!.locked_reason).toMatch(/pre-test/)
    expect(await one('select public.next_activity($1) as r', [class_id])).toBeNull()
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(1), '{"viewed":true}'], /locked: Take the pre-test first/)

    // The pre-test is shown without keys, and can be taken once.
    const shown = await one<{ kind: string; taken: boolean; items: Row[] }>('select public.get_assessment($1) as r', [PRE])
    expect(shown).toMatchObject({ kind: 'pre', taken: false })
    expect(shown.items).toHaveLength(5)
    expect(JSON.stringify(shown)).not.toMatch(/correctChoiceId|accepted|blanks":\[\[/)
    const wrong = ['pre-assign', 'pre-count', 'pre-keyword']                       // 2 of 5 right
    const pre = await one<{ score_pct: number; per_concept: { concept: string; pct: number }[] }>(
      'select public.submit_assessment($1, $2::jsonb) as r', [PRE, JSON.stringify(await testAnswers(PRE, wrong))])
    expect(Number(pre.score_pct)).toBe(40)
    await as(student)
    await fails('select public.submit_assessment($1, $2::jsonb)', [PRE, JSON.stringify(await testAnswers(PRE))], /already took/)
    await as(student)

    // Now the module opens, strictly in order.
    let next = await one<{ activity_id: string }>('select public.next_activity($1) as r', [class_id])
    expect(next.activity_id).toBe(ACT(1))
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(3), '{"answers":{}}'], /locked: Finish the earlier activities first/)
    await fails('select public.get_activity($1)', [ACT(3)], /locked/)
    expect((await done(ACT(1))).completed).toBe(true)
    expect((await done(ACT(2))).next_activity_id).toBe(ACT(3))

    // A check completes only when every scored answer is right, with a hint from the ladder meanwhile.
    const k3 = await keysFor(ACT(3))
    await as(student)
    const miss = await submit(ACT(3), answers(k3, ['q-vars-1']))
    expect(miss).toMatchObject({ is_correct: false, completed: false, feedback: 'Work out the right side first, using the value x has right now.', explanation: null })
    expect(JSON.stringify(miss)).not.toMatch(/correctChoiceId/)
    const hit = await submit(ACT(3), answers(k3))
    expect(hit).toMatchObject({ is_correct: true, completed: true, explanation: 'x + 2 uses the old value, 3, so x becomes 5.' })

    // Worksheet: every question is graded; it completes on a full submission and records the score.
    await done(ACT(4))
    const k5 = await keysFor(ACT(5))
    await as(student)
    const sheet = await submit(ACT(5), answers(k5, ['q-loop-3', 'q-loop-4']))
    expect(sheet).toMatchObject({ is_correct: false, completed: true })
    expect(Number(sheet.score)).toBe(50)
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(5), '{"answers":{"q-loop-1":{"text":"range"}}}'], /Answer every question/)
    await as(student)

    const k6 = await keysFor(ACT(6))
    await as(student)
    expect((await submit(ACT(6), answers(k6, ['q-loop-c1']))).completed).toBe(false)
    expect((await submit(ACT(6), answers(k6))).completed).toBe(true)

    // Post-test stays locked until the last required activity is done.
    await fails('select public.get_assessment($1)', [POST], /locked/)
    await as(student)
    const exit = await submit(ACT(7), { answers: { 'q-exit-1': { text: 'Remembering range starts at 0.' } } })
    expect(exit).toMatchObject({ is_correct: null, completed: true, module_completed: true })
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(7), '{"answers":{"q-exit-1":{"text":""}}}'], /reflection/)
    await as(student)

    // Post-test now opens; learning gain appears with the exact ADR 0020 numbers.
    const post = await one<{ score_pct: number }>('select public.submit_assessment($1, $2::jsonb) as r', [POST, JSON.stringify(await testAnswers(POST))])
    expect(Number(post.score_pct)).toBe(100)
    await as(student)
    const gain = (await q<Row>(`select pre_pct, post_pct, gain_points, normalized_gain, status from v_learning_gain where scope = 'student' and concept_id is null`))[0]!
    expect(gain).toMatchObject({ status: 'complete' })
    expect([Number(gain.pre_pct), Number(gain.post_pct), Number(gain.gain_points), Number(gain.normalized_gain)]).toEqual([40, 100, 60, 1])
    const progress = await one<{ completed: number; total: number; modules: { pct: number; gain: number }[] }>('select public.get_my_progress($1) as r', [class_id])
    expect(progress).toMatchObject({ completed: 7, total: 7 })
    expect(Number(progress.modules[0]!.gain)).toBe(60)

    // The instructor sees the student and the class; the class row is a mean of complete students only.
    await as(ins)
    expect((await q('select * from v_class_progress where class_id = $1 and student_id is not null', [class_id]))).toHaveLength(1)
    expect((await q<Row>(`select complete_count, incomplete_count from v_learning_gain where scope = 'class' and class_id = $1 and concept_id is null`, [class_id]))[0]).toEqual({ complete_count: 1, incomplete_count: 0 })
  })

  it('records time on task and refuses to count it for locked work', async () => {
    const { student } = await setup()
    await as(student)
    await fails('select public.heartbeat($1, 10)', [ACT(1)], /locked/)
    await fails('select public.heartbeat($1, 999)', [ACT(1)], /between 0 and 60/)
  })

  it('a student cannot submit for another class or another student', async () => {
    const { student } = await setup()
    await as(student)
    await fails('select public.submit_answer($1, $2::jsonb, $3)', [ACT(1), '{"viewed":true}', P1], /not assigned to you/)
    const stranger = await mkUser()
    await as(stranger)
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(1), '{"viewed":true}'], /not assigned to you/)
  })

  it('an instructor can reset a test so it can be retaken', async () => {
    const { student, ins, class_id } = await setup()
    await as(student)
    await q('select public.submit_assessment($1, $2::jsonb)', [PRE, JSON.stringify(await testAnswers(PRE))])
    await as(student)
    await as(ins)
    await q('select public.reset_assessment_result($1, $2, $3)', [student, class_id, PRE])
    await as(student)
    expect((await one<{ taken: boolean }>('select public.get_assessment($1) as r', [PRE])).taken).toBe(false)
  })

  it('a lost code is reset and the student keeps their progress on a new device', async () => {
    const { student, ins, class_id, roster } = await setup()
    await as(student)
    await q('select public.submit_assessment($1, $2::jsonb)', [PRE, JSON.stringify(await testAnswers(PRE))])
    await as(ins)
    const { login_code } = await one<{ login_code: string }>('select public.reset_login_code($1) as r', [roster[0]!.member_id])
    const phone = await mkUser()
    await as(phone)
    await q('select public.claim_login_code($1)', [login_code])
    expect((await one<{ taken: boolean }>('select public.get_assessment($1) as r', [PRE])).taken).toBe(true)
    expect(await q('select 1 from assessment_results where class_id = $1', [class_id])).toHaveLength(1)
  })

  it('a late joiner picks their name with the class join code, and only unclaimed names show', async () => {
    const { ins, class_id } = await setup()
    await as(ins)
    const { join_code } = await one<{ join_code: string }>('select public.create_join_code($1) as r', [class_id])
    const late = await mkUser()
    await as(late)
    const seats = await one<{ member_id: string; label: string }[]>('select public.list_join_roster($1) as r', [join_code])
    expect(seats.map((s) => s.label)).toEqual(['Sam R.'])                       // Pat R. already claimed
    await q('select public.claim_roster_seat($1, $2)', [join_code, seats[0]!.member_id])
    await fails('select public.list_join_roster($1)', ['NOPE-NOPE-NOPE'], /not found/)
    const other = await mkUser()
    await as(other)
    await fails('select public.claim_roster_seat($1, $2)', [join_code, seats[0]!.member_id], /already taken/)
  })

  it('roster import is all or nothing and names only', async () => {
    const ins = await mkUser('instructor')
    await as(ins)
    const { class_id } = await one<{ class_id: string }>(`select public.create_class('Demo High School', 'R') as r`)
    await fails(`select public.import_roster($1, '["Ok N.","a@b.com"]'::jsonb)`, [class_id], /no emails/)
    await fails(`select public.import_roster($1, '["Dup","dup"]'::jsonb)`, [class_id], /Duplicate/)
    expect(await q('select * from class_members where class_id = $1 and member_role = $2', [class_id, 'student'])).toHaveLength(0)
    const other = await mkUser('instructor')
    await as(other)
    await fails(`select public.import_roster($1, '["X"]'::jsonb)`, [class_id], /Not allowed/)
  })

  it('an independent learner browses as a guest, registers by name only, and keeps view credit', async () => {
    await as(null)
    const open = await one<{ lessons: { activities: { activity_id: string }[] }[] }[]>('select public.list_open_modules() as r')
    expect(open).toHaveLength(1)
    const guestView = await one<{ kind: string; content: Row }>('select public.get_activity($1) as r', [ACT(2)])
    expect(guestView.kind).toBe('reading')
    await fails('select public.submit_answer($1, $2::jsonb)', [ACT(2), '{"viewed":true}'], /permission denied/)   // guests cannot write

    const kid = await mkUser()
    await as(kid)
    await fails(`select public.self_register('me@home.com')`, [], /no email/)
    const reg = await one<{ class_id: string; login_code: string }>(`select public.self_register('Robin') as r`)
    expect(reg.class_id).toBe(OPEN_CLASS)
    expect(reg.login_code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/)
    const imported = await one<{ imported: number }>(`select public.import_guest_progress($1::jsonb) as r`, [JSON.stringify({
      version: 1, completed: { [ACT(1)]: { completed_at: '2026-11-14T10:00:00Z' }, [ACT(3)]: { completed_at: '2026-11-14T10:05:00Z' }, 'not-a-uuid': { completed_at: 'x' } } })])
    expect(imported.imported).toBe(1)                                          // only the video counts; checks must be done for real
    await as(kid)
    // In CIC Open modules are not chained and there is no pre-test lock for browsing lessons already viewed.
    expect((await one<{ status: string }>('select public.get_activity($1) as r', [ACT(1)])).status).toBe('done')
  })

  describe('late joiners start at a module the instructor chooses', () => {
    type Outline = { modules: { module_id: string; pretest: { status: string } | null; posttest: { status: string } | null; lessons: { activities: { activity_id: string; status: string; locked_reason: string | null }[] }[] }[] }

    /** A second published module (one video, no tests) assigned after the seed module. */
    async function addSecondModule(ins: string, class_id: string) {
      await asSuper()
      const mod = await one<string>(`insert into modules (slug, title, status, created_by) values ($1, 'Functions', 'draft', $2) returning id as r`, [`test-fn-${randomUUID()}`, ins])
      const lesson = await one<string>(`insert into lessons (module_id, position, title) values ($1, 0, 'Defining functions') returning id as r`, [mod])
      const act = await one<string>(
        `insert into activities (lesson_id, position, kind, title, content, required) select $1, 0, kind, 'Watch: functions', content, true from activities where id = $2 returning id as r`,
        [lesson, ACT(1)])
      await q(`update modules set status = 'published', published_at = now() where id = $1`, [mod])
      await as(ins)
      await q('select public.assign_module($1, $2)', [class_id, mod])
      return { mod, act }
    }

    it('places an imported student at module 2 before they sign in; module 1 is skipped, not missing', async () => {
      const { ins, class_id, roster } = await setup()
      const { mod, act } = await addSecondModule(ins, class_id)
      const sam = roster[1]!                                                    // imported, not signed in yet
      await as(ins)
      const placed = await one<Row>('select public.set_start_module($1::uuid[], $2) as r', [[sam.member_id], mod])
      expect(placed).toEqual({ students: 1, start_module_id: mod, skipped_modules: 1 })

      const late = await mkUser()
      await as(late)
      await q('select public.claim_login_code($1)', [sam.login_code])
      const outline = await one<Outline>('select public.get_class_outline($1) as r', [class_id])
      const [m1, m2] = outline.modules
      expect(m1!.pretest!.status).toBe('skipped')
      expect(m1!.posttest!.status).toBe('skipped')
      expect(m1!.lessons.flatMap((l) => l.activities).every((a) => a.status === 'skipped' && a.locked_reason === null)).toBe(true)
      expect(m2!.lessons[0]!.activities[0]!.status).toBe('available')
      // "Start here" is module 2's first activity, and the server lets them do it.
      expect(await one('select public.next_activity($1) as r', [class_id])).toMatchObject({ activity_id: act })
      expect(await one<Row>('select public.submit_answer($1, $2::jsonb) as r', [act, '{"viewed":true}'])).toMatchObject({ completed: true })
      // Skipped work stays open to review.
      expect((await one<{ status: string }>('select public.get_activity($1) as r', [ACT(1)])).status).toBe('skipped')

      // The instructor's progress view counts only module 2: 1 of 1 done.
      await as(ins)
      const [row] = await q<{ required_activities: number; completed_activities: number }>(
        'select required_activities, completed_activities from v_class_progress where class_id = $1 and student_id = $2', [class_id, late])
      expect(row).toEqual({ required_activities: 1, completed_activities: 1 })
    })

    it('the catch-up plan leaves out modules the student was told to skip', async () => {
      const { ins, class_id, roster, student } = await setup()
      const { mod, act } = await addSecondModule(ins, class_id)
      await as(ins)
      await q('select public.set_start_module($1::uuid[], $2)', [[roster[0]!.member_id], mod])
      await as(student)
      type Plan = { steps_left: number; steps: { kind: string; activity_id: string | null; title: string }[] }
      const plan = await one<Plan>('select public.get_catch_up($1) as r', [class_id])
      // Only module 2's one video is left: no pre-test, activities or post-test from skipped module 1.
      expect(plan.steps_left).toBe(1)
      expect(plan.steps).toEqual([expect.objectContaining({ kind: 'video', activity_id: act, title: 'Watch: functions' })])
      expect(plan.steps.some((s) => /Variables and Loops/.test(s.title))).toBe(false)
    })

    it('"from the beginning" clears the placement, and a classmate is unaffected', async () => {
      const { ins, class_id, roster, student } = await setup()
      const { mod } = await addSecondModule(ins, class_id)
      await as(ins)
      await q('select public.set_start_module($1::uuid[], $2)', [[roster[0]!.member_id], mod])
      await as(student)
      expect((await one<Outline>('select public.get_class_outline($1) as r', [class_id])).modules[0]!.pretest!.status).toBe('skipped')
      await as(ins)
      expect(await one<Row>('select public.set_start_module($1::uuid[], null) as r', [[roster[0]!.member_id]])).toMatchObject({ skipped_modules: 0 })
      await as(student)
      expect((await one<Outline>('select public.get_class_outline($1) as r', [class_id])).modules[0]!.pretest!.status).toBe('available')
      await as(ins)
      expect(await q('select 1 from module_skips where class_id = $1', [class_id])).toHaveLength(0)
    })

    it('a signed-in student can open CIC Open lessons outside their class, but not other modules', async () => {
      const { ins, class_id } = await setup()
      const { act: notOpen } = await addSecondModule(ins, class_id)            // published, not in CIC Open
      // A student in a class with NO modules: the seed module is only reachable because it is open.
      await as(ins)
      const other = await one<{ class_id: string }>(`select public.create_class('demo high school', 'No modules') as r`)
      const [seat] = await one<{ login_code: string }[]>(`select public.import_roster($1, '["Lee T."]'::jsonb) as r`, [other.class_id])
      const lee = await mkUser()
      await as(lee)
      await q('select public.claim_login_code($1)', [seat!.login_code])
      const open = await one<{ activity_id: string; status: string }>('select public.get_activity($1) as r', [ACT(2)])
      expect(open).toMatchObject({ activity_id: ACT(2), status: 'available' })
      await fails('select public.get_activity($1)', [notOpen], /Activity not found/)
    })

    it('only the class instructor or an admin can place students, and only into the class modules', async () => {
      const { ins, class_id, roster, student } = await setup()
      const { mod } = await addSecondModule(ins, class_id)
      const seat = [roster[1]!.member_id]
      await as(student)
      await fails('select public.set_start_module($1::uuid[], $2)', [seat, mod], /Not allowed/)
      await fails(`insert into module_skips (member_id, class_id, module_id) values ($1, $2, $3)`, [seat[0], class_id, MODULE], /permission denied/)
      const other = await mkUser('instructor')
      await as(other)
      await fails('select public.set_start_module($1::uuid[], $2)', [seat, mod], /Not allowed/)
      await as(ins)
      await fails('select public.set_start_module($1::uuid[], $2)', [seat, randomUUID()], /not assigned to this class/)
      await fails('select public.set_start_module($1::uuid[], $2)', [[randomUUID()], mod], /not found in one class/)
      await fails(`select public.set_start_module('{}'::uuid[], $1)`, [mod], /between 1 and 300/)
      const admin = await mkUser('cic_admin')
      await as(admin)
      expect(await one<Row>('select public.set_start_module($1::uuid[], $2) as r', [seat, mod])).toMatchObject({ skipped_modules: 1 })
    })
  })
})

describe.skipIf(!up)('authoring and publishing', () => {
  const draft = (over: Row = {}) => ({
    slug: `t-${randomUUID().slice(0, 8)}`, title: 'Test module', summary: 's',
    lessons: [{ title: 'L1', activities: [{
      kind: 'check', title: 'Check', required: true,
      content: { questions: [{ id: 'q1', type: 'mcq', prompt: 'Pick b', conceptId: 'loops', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }] },
      keys: [{ question_id: 'q1', key: { type: 'mcq', correctChoiceId: 'b', hints: [] } }] }] }],
    assessments: [
      { kind: 'pre', title: 'Pre', items: [{ pair_key: 'p1', concept_id: 'loops', question_id: 'pre1', content: { id: 'pre1', type: 'mcq', prompt: 'x', conceptId: 'loops', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, key: { type: 'mcq', correctChoiceId: 'a' } }] },
      { kind: 'post', title: 'Post', items: [{ pair_key: 'p1', concept_id: 'loops', question_id: 'post1', content: { id: 'post1', type: 'mcq', prompt: 'y', conceptId: 'loops', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, key: { type: 'mcq', correctChoiceId: 'b' } }] },
    ],
    ...over,
  })
  const save = (m: Row) => one<string>('select public.save_module_draft($1::jsonb) as r', [JSON.stringify(m)])

  it('a module with no tests submits with a warning, and one with no lessons is refused in words', async () => {
    const author = await mkUser('instructor', { author: true })
    await as(author)
    const noTests = await one<{ errors: string[]; warnings: string[] }>('select public.submit_module($1) as r', [await save(draft({ assessments: [] }))])
    expect(noTests.errors).toEqual([])
    expect(noTests.warnings).toContain('This module has no pre or post test, so it will have no learning gain')
    await fails('select public.submit_module($1)', [await save(draft({ lessons: [] }))], /Fix these first: Add at least one lesson/)
  })

  it('author drafts, submits; only an admin publishes; published is frozen; drafts stay private', async () => {
    const author = await mkUser('instructor', { author: true })
    const rival = await mkUser('instructor', { author: true })
    const admin = await mkUser('cic_admin')
    const student = await mkUser()
    await as(author)
    const id = await save(draft())
    expect((await q('select * from modules where id = $1', [id])).length).toBe(1)

    await as(rival)
    expect((await q('select * from modules where id = $1', [id])).length).toBe(0)            // other authors cannot see my draft
    await fails('select public.save_module_draft($1::jsonb)', [JSON.stringify({ ...draft(), module_id: id })], /Only the owner/)
    await as(student)
    expect((await q('select * from modules where id = $1', [id])).length).toBe(0)
    await as(admin)
    expect((await q('select * from modules where id = $1', [id])).length).toBe(1)             // admins can

    await as(author)
    const warn = await one<{ errors: string[]; warnings: string[] }>('select public.submit_module($1) as r', [id])
    expect(warn.errors).toEqual([])
    await fails('select public.publish_module($1)', [id], /Only a CIC admin/)
    await fails('select public.save_module_draft($1::jsonb)', [JSON.stringify({ ...draft(), module_id: id })], /Only the owner/) // locked once submitted

    await as(admin)
    await q('select public.publish_module($1)', [id])
    await asSuper()
    await fails(`update lessons set title = 'x' where module_id = $1`, [id], /immutable/)
    await fails(`delete from activities where lesson_id in (select id from lessons where module_id = $1)`, [id], /immutable/)
    await fails(`update modules set title = 'x' where id = $1`, [id], /immutable/)
    await fails(`update assessment_items set pair_key = 'zzz' where assessment_id in (select id from assessments where module_id = $1)`, [id], /immutable/)

    // Published now: a student in a class that has it can read it; guests and others can read it too.
    await as(student)
    expect((await q('select * from modules where id = $1', [id])).length).toBe(0)             // students only see modules assigned to their class
  })

  it('submit and publish are blocked while a scored question has no valid key', async () => {
    const author = await mkUser('instructor', { author: true })
    const admin = await mkUser('cic_admin')
    await as(author)
    const bad = draft()
    ;(bad.lessons[0]!.activities[0] as Row).keys = []
    const id = await save(bad)
    await fails('select public.submit_module($1)', [id], /no answer key/)
    await as(admin)
    await fails('select public.publish_module($1)', [id], /no answer key/)
    await as(author)
    const wrongChoice = draft()
    ;((wrongChoice.lessons[0]!.activities[0] as Row).keys as Row[])[0]!.key = { type: 'mcq', correctChoiceId: 'zzz', hints: [] }
    await fails('select public.submit_module($1)', [await save(wrongChoice)], /not one of the choices/)
  })

  it('warns, but does not block, when a test item has no twin', async () => {
    const author = await mkUser('instructor', { author: true })
    await as(author)
    const m = draft()
    ;((m.assessments as Row[])[1]!.items as Row[])[0]!.pair_key = 'different'
    const id = await save(m)
    const res = await one<{ errors: string[]; warnings: string[] }>('select public.submit_module($1) as r', [id])
    expect(res.errors).toEqual([])
    expect(res.warnings.join(' ')).toMatch(/no matching item/)
  })

  it('a new version is a deep copy with its keys, and the old one stays frozen', async () => {
    const author = await mkUser('instructor', { author: true })
    const admin = await mkUser('cic_admin')
    await as(author)
    const v2 = await one<string>('select public.new_module_version($1) as r', [MODULE])
    await asSuper()
    const copy = (await q<{ version: number; status: string }>('select version, status from modules where id = $1', [v2]))[0]!
    expect(copy).toEqual({ version: 2, status: 'draft' })
    expect((await q('select * from activity_keys where activity_id in (select a.id from activities a join lessons l on l.id = a.lesson_id where l.module_id = $1)', [v2])).length).toBe(6)
    expect((await q('select * from assessment_keys where assessment_item_id in (select i.id from assessment_items i join assessments a on a.id = i.assessment_id where a.module_id = $1)', [v2])).length).toBe(10)
    await as(author)
    await fails('select public.new_module_version($1)', [MODULE], /already a draft/)    // one open draft per module
    await as(admin)
    await q('select public.publish_module($1)', [v2])                                    // a straight copy validates
  })

  it('only published modules can be given to a class', async () => {
    const ins = await mkUser('instructor', { author: true })
    await as(ins)
    const { class_id } = await one<{ class_id: string }>(`select public.create_class('Demo High School', 'C') as r`)
    const id = await save(draft())
    await fails('select public.assign_module($1, $2)', [class_id, id], /Only published/)
  })

  it('the unlock engine keeps modules in order within a class', async () => {
    const ins = await mkUser('instructor', { author: true })
    const admin = await mkUser('cic_admin')
    await as(ins)
    const second = await save(draft())
    await q('select public.submit_module($1)', [second])
    await as(admin)
    await q('select public.publish_module($1)', [second])
    await as(ins)
    const { class_id } = await one<{ class_id: string }>(`select public.create_class('Demo High School', 'Two') as r`)
    const roster = await one<{ login_code: string }[]>(`select public.import_roster($1, '["Zed"]'::jsonb) as r`, [class_id])
    await q('select public.assign_module($1, $2)', [class_id, MODULE])
    await q('select public.assign_module($1, $2)', [class_id, second])
    const kid = await mkUser()
    await as(kid)
    await q('select public.claim_login_code($1)', [roster[0]!.login_code])
    const outline = await one<{ modules: { position: number; lessons: { activities: { status: string; locked_reason?: string }[] }[] }[] }>('select public.get_class_outline($1) as r', [class_id])
    expect(outline.modules.map((m) => m.position)).toEqual([0, 1])
    expect(outline.modules[1]!.lessons[0]!.activities[0]).toMatchObject({ status: 'locked', locked_reason: 'Finish the earlier module first' })
  })
})

describe.skipIf(!up)('read API views', () => {
  it('only service_role can read the unfiltered aggregates, and small groups are suppressed', async () => {
    await as(SEED_STUDENT_1)
    await fails('select * from api_class_gain', [], /permission denied/)
    await asSuper()
    await client.query('set local role service_role')
    const rows = await q<{ class_id: string; complete_count: number }>('select class_id, complete_count from api_class_gain where concept_id is null')
    expect(rows.map((r) => r.class_id).sort()).toEqual([P1, '11000000-0000-4000-8000-000000000002'].sort())
    expect(rows.every((r) => Number(r.complete_count) >= 5)).toBe(true)
    expect(Object.keys((await q('select * from api_class_gain limit 1'))[0]!)).not.toContain('student_id')
    expect((await q('select * from api_class_progress')).length).toBe(2)
    await client.query('reset role')
  })

  it('API keys are shown once, stored hashed, validated and revocable', async () => {
    const admin = await mkUser('cic_admin')
    await as(admin)
    const { api_key_id, raw_key } = await one<{ api_key_id: string; raw_key: string }>(`select public.create_api_key('Dashboard', '{progress}') as r`)
    expect(raw_key).toMatch(/^oh_[0-9a-f]{64}$/)
    expect((await q<{ name: string }>('select name from api_keys'))[0]!.name).toBe('Dashboard')
    await fails('select * from api_key_secrets', [], /permission denied/)
    await asSuper()
    expect((await q<{ key_hash: string }>('select key_hash from api_key_secrets'))[0]!.key_hash).not.toContain(raw_key)
    await client.query('set local role service_role')
    expect(await one('select public.validate_api_key($1) as r', [raw_key])).toMatchObject({ scope: ['progress'] })
    expect(await one('select public.validate_api_key($1) as r', ['oh_' + '0'.repeat(64)])).toBeNull()
    await client.query('reset role')
    await as(admin)
    await q('select public.revoke_api_key($1)', [api_key_id])
    await asSuper()
    await client.query('set local role service_role')
    expect(await one('select public.validate_api_key($1) as r', [raw_key])).toBeNull()
    await client.query('reset role')
  })
})

describe.skipIf(!up)('stuck and not-started lists', () => {
  it('flag the seeded stuck student and the student who has not started', async () => {
    const ins = await mkUser('instructor')
    await asSuper()
    await q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'instructor', 'T')`, [P1, ins])
    await as(ins)
    const stuck = await q<{ student_id: string; reasons: string[] }>('select student_id, reasons from v_stuck')
    expect(stuck).toHaveLength(1)
    expect(stuck[0]).toMatchObject({ student_id: 'b0000000-0000-4000-8000-000000000004', reasons: ['wrong_attempts', 'long_time'] })
    const ns = (await q<{ display_name: string }>('select display_name from v_not_started order by display_name')).map((r) => r.display_name)
    expect(ns).toEqual(['Cam R.', 'Demo S.', 'Fay L.'])        // pre-test only, the unclaimed demo seat, and a student who never started
  })
})

describe.skipIf(!up)('get_me and class staffing', () => {
  /** A signed-in role with no uid, the way a request with a malformed JWT would look. */
  async function asNoUid() {
    await client.query('reset role')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'authenticated' })])
  }
  const meAs = async (uid: string) => { await as(uid); return one<Row | null>('select public.get_me() as r') }
  const classIdsAs = async (uid: string) => { await as(uid); return (await q<{ id: string }>('select id from classes')).map((c) => c.id) }

  it('get_me is null when there is no user id, and anon cannot execute it at all', async () => {
    await asNoUid()
    expect(await one('select public.get_me() as r')).toBeNull()
    await as(null)
    await fails('select public.get_me()', [], /permission denied/)
  })

  it('a fresh anonymous student is a student with no class', async () => {
    const id = await mkUser()
    expect(await meAs(id)).toEqual({ profile_id: id, role: 'student', can_author: false, display_name: '', class_id: null, class_name: null })
  })

  it('after claiming the demo login code the student gets class and roster name', async () => {
    const id = await mkUser()
    await as(id)
    await q('select public.claim_login_code($1)', ['DEMO-0000-0000-0001'])
    expect(await meAs(id)).toMatchObject({ role: 'student', class_id: P1, class_name: 'Demo Period 1', display_name: 'Demo S.' })
  })

  it('staff get their role and no class', async () => {
    const id = await mkUser('instructor', { author: true })
    expect(await meAs(id)).toMatchObject({ role: 'instructor', can_author: true, class_id: null, class_name: null })
  })

  it('an admin adds an instructor to a class and they then see its data', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor')
    expect(await classIdsAs(ins)).toEqual([])
    await as(admin)
    await q('select public.add_class_instructor($1, $2)', [P1, ins])
    expect(await classIdsAs(ins)).toEqual([P1])
    expect(new Set((await q<{ class_id: string }>('select class_id from v_class_progress')).map((r) => r.class_id))).toEqual(new Set([P1]))
    const stuck = await q<{ student_id: string }>('select student_id from v_stuck')
    expect(stuck.map((r) => r.student_id)).toEqual(['b0000000-0000-4000-8000-000000000004'])
  })

  it('adding the same instructor twice is a no-op', async () => {
    const admin = await mkUser('cic_admin')
    const ins = await mkUser('instructor')
    await as(admin)
    await q('select public.add_class_instructor($1, $2)', [P1, ins])
    await q('select public.add_class_instructor($1, $2)', [P1, ins])
    await asSuper()
    expect(await q(`select 1 from class_members where class_id = $1 and profile_id = $2`, [P1, ins])).toHaveLength(1)
  })

  it('only a CIC admin can add or remove instructors', async () => {
    const ins = await mkUser('instructor')
    const other = await mkUser('instructor')
    await as(ins)
    await fails('select public.add_class_instructor($1, $2)', [P1, other], /Only a CIC admin can add instructors/)
    await fails('select public.remove_class_instructor($1, $2)', [P1, other], /Only a CIC admin can remove instructors/)
    await as(SEED_STUDENT_1)
    await fails('select public.add_class_instructor($1, $2)', [P1, other], /Only a CIC admin/)
  })

  it('rejects a student profile, a missing class and a student already in the class', async () => {
    const admin = await mkUser('cic_admin')
    const stu = await mkUser()
    const ins = await mkUser('instructor')
    await as(admin)
    await fails('select public.add_class_instructor($1, $2)', [P1, stu], /not an instructor/)
    await fails('select public.add_class_instructor($1, $2)', [randomUUID(), ins], /Class not found/)
    await fails('select public.add_class_instructor($1, $2)', [P1, randomUUID()], /not an instructor/)
    await asSuper()
    await q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'student', 'Odd S.')`, [P1, ins])
    await as(admin)
    await fails('select public.add_class_instructor($1, $2)', [P1, ins], /student in this class/)
  })

  it('removing an instructor works, but a school class keeps at least one', async () => {
    const admin = await mkUser('cic_admin')
    const a = await mkUser('instructor')
    const b = await mkUser('instructor')
    await as(admin)
    await q('select public.add_class_instructor($1, $2)', [P1, a])
    await q('select public.add_class_instructor($1, $2)', [P1, b])
    await fails('select public.remove_class_instructor($1, $2)', [randomUUID(), a], /Class not found/)
    await q('select public.remove_class_instructor($1, $2)', [P1, a])
    expect(await classIdsAs(a)).toEqual([])
    expect(await classIdsAs(b)).toEqual([P1])
    await as(admin)
    await fails('select public.remove_class_instructor($1, $2)', [P1, b], /at least one instructor/)
    await q('select public.remove_class_instructor($1, $2)', [P1, a])   // not an instructor any more: no-op
  })

  it('anon and students cannot execute the staffing functions', async () => {
    await as(null)
    await fails('select public.add_class_instructor($1, $2)', [P1, randomUUID()], /permission denied/)
    await fails('select public.remove_class_instructor($1, $2)', [P1, randomUUID()], /permission denied/)
  })
})

describe.skipIf(!up)('code activities', () => {
  // A published module with one code activity, assigned to a fresh class with one student.
  async function setup() {
    const admin = await mkUser('cic_admin')
    await as(admin)
    const draft = {
      slug: `code-${randomUUID().slice(0, 8)}`, title: 'Code module', summary: '',
      lessons: [{ title: 'L', activities: [{ kind: 'code', title: 'Make it count', required: true, concept_id: 'loops',
        content: { prompt: 'Print 1 to 3', starter: 'print(1)', tests: ['assert True', 'assert 1 == 1'] }, keys: [] }] }],
      assessments: [],
    }
    const moduleId = await one<string>('select public.save_module_draft($1::jsonb) as r', [JSON.stringify(draft)])
    await q('select public.publish_module($1)', [moduleId])
    const { class_id } = await one<{ class_id: string }>(`select public.create_class('Demo High School', 'Code class') as r`)
    await q('select public.assign_module($1, $2)', [class_id, moduleId])
    const roster = await one<{ login_code: string }[]>(`select public.import_roster($1, '["Kai C."]'::jsonb) as r`, [class_id])
    const student = await mkUser()
    await as(student)
    await q('select public.claim_login_code($1)', [roster[0]!.login_code])
    await asSuper()
    const act = (await q<{ id: string }>(`select a.id from activities a join lessons l on l.id = a.lesson_id where l.module_id = $1`, [moduleId]))[0]!.id
    await as(student)
    return { act, class_id }
  }
  const submit = (act: string, r: object) => one<{ completed: boolean; score: number; is_correct: boolean; feedback: string | null }>('select public.submit_answer($1, $2::jsonb) as r', [act, JSON.stringify(r)])

  it('completes only when every check passes, and says how many pass otherwise', async () => {
    const { act } = await setup()
    const partial = await submit(act, { code: 'print(2)', passed: 1, total: 2, prediction: 'It prints 1' })
    expect(partial).toMatchObject({ completed: false, is_correct: false, score: 50, feedback: '1 of 2 checks pass. Read the first failing check and run your code again.' })
    expect(await submit(act, { code: 'print(1)\nprint(2)', passed: 2, total: 2 })).toMatchObject({ completed: true, is_correct: true, score: 100 })
  })

  it('refuses counts that do not match the activity, code over 10 KB, and a missing code field', async () => {
    const { act } = await setup()
    await fails('select public.submit_answer($1, $2::jsonb)', [act, JSON.stringify({ code: 'x', passed: 5, total: 5 })], /do not match/)
    await fails('select public.submit_answer($1, $2::jsonb)', [act, JSON.stringify({ code: 'x', passed: 3, total: 2 })], /do not match/)
    await fails('select public.submit_answer($1, $2::jsonb)', [act, JSON.stringify({ code: 'x'.repeat(10001), passed: 2, total: 2 })], /Send your code/)
    await fails('select public.submit_answer($1, $2::jsonb)', [act, JSON.stringify({ passed: 2, total: 2 })], /Send your code/)
  })

  it('the database refuses a code activity without starter code or with too many checks', async () => {
    const author = await mkUser('instructor', { author: true })
    await as(author)
    const bad = (content: object) => JSON.stringify({ slug: `b-${randomUUID().slice(0, 8)}`, title: 'B', summary: '', lessons: [{ title: 'L', activities: [{ kind: 'code', title: 'C', required: true, content, keys: [] }] }], assessments: [] })
    await fails('select public.save_module_draft($1::jsonb)', [bad({ prompt: 'p', tests: [] })], /activities_content_shape/)
    await fails('select public.save_module_draft($1::jsonb)', [bad({ prompt: 'p', starter: '', tests: Array(11).fill('assert True') })], /activities_content_shape/)
    const video = JSON.stringify({ slug: `v-${randomUUID().slice(0, 8)}`, title: 'V', summary: '', lessons: [{ title: 'L', activities: [{ kind: 'video', title: 'V', required: true, content: { transcript: 'no link' }, keys: [] }] }], assessments: [] })
    await fails('select public.save_module_draft($1::jsonb)', [video], /activities_content_shape/) // the old check let this through
  })
})

describe.skipIf(!up)('catch-up plan', () => {
  type Plan = { steps_left: number; minutes_left: number; behind_by: number; steps: { kind: string; title: string; minutes: number }[] }

  it('gives a student who fell behind their remaining steps in order, with minutes, and how far behind they are', async () => {
    const seat = (await q<{ profile_id: string }>(`select profile_id from class_members where class_id = $1 and display_name = 'Cam R.'`, [P1]))[0]!.profile_id
    await as(seat)
    const plan = await one<Plan>('select public.get_catch_up($1) as r', [P1])
    expect(plan.steps_left).toBeGreaterThan(5)
    expect(plan.behind_by).toBeGreaterThan(0)
    expect(plan.minutes_left).toBeGreaterThanOrEqual(plan.steps.reduce((n, s) => n + s.minutes, 0))
    expect(plan.steps[0]!.kind).not.toBe('posttest')
    expect(plan.steps.at(-1)!.kind).toBe('posttest')
    expect(plan.steps.every((s) => s.minutes >= 1)).toBe(true)
  })

  it('is empty for a student who has finished everything, and refused for a class you are not in', async () => {
    await as(SEED_STUDENT_1)
    const done = await one<Plan>('select public.get_catch_up($1) as r', [P1])
    expect(done).toMatchObject({ steps_left: 0, minutes_left: 0, behind_by: 0, steps: [] })
    await fails('select public.get_catch_up($1)', ['11000000-0000-4000-8000-000000000002'], /not in this class/)
    await as(null)
    await fails('select public.get_catch_up($1)', [P1], /permission denied/)
  })

  it('a fresh student starts with the pre-test', async () => {
    const id = await mkUser()
    await as(id)
    await q('select public.claim_login_code($1)', ['DEMO-0000-0000-0001'])
    const plan = await one<Plan>('select public.get_catch_up($1) as r', [P1])
    expect(plan.steps[0]).toMatchObject({ kind: 'pretest', title: 'Pre-test: Variables and Loops' })
  })

  it('lets the class instructor see everyone, and nobody else', async () => {
    const ins = await mkUser('instructor')
    await asSuper()
    await q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'instructor', 'T')`, [P1, ins])
    await as(ins)
    const rows = await one<{ display_name: string; steps_left: number; behind_by: number }[]>('select public.get_class_catch_up($1) as r', [P1])
    expect(rows.length).toBeGreaterThan(5)
    expect(rows.find((r) => r.display_name === 'Cam R.')!.behind_by).toBeGreaterThan(0)
    await fails('select public.get_class_catch_up($1)', ['11000000-0000-4000-8000-000000000002'], /Not allowed/)
    await as(SEED_STUDENT_1)
    await fails('select public.get_class_catch_up($1)', [P1], /Not allowed/)
    await fails('select public._catch_up_steps($1, $2)', [SEED_STUDENT_1, P1], /permission denied/)
  })
})

describe.skipIf(!up)('misconception radar', () => {
  type Row = { activity_title: string; question: { id: string; type: string }; answered: number; wrong: number; answers: { answer: Record<string, unknown>; students: number }[] }

  it("groups students' first wrong answers per question for the class instructor, and nobody else", async () => {
    const ins = await mkUser('instructor')
    await asSuper()
    await q(`insert into class_members (class_id, profile_id, member_role, display_name) values ($1, $2, 'instructor', 'T')`, [P1, ins])
    await as(ins)
    const rows = await one<Row[]>('select public.get_class_misconceptions($1) as r', [P1])
    const vars = rows.find((r) => r.question.id === 'q-vars-1')!
    expect(vars.wrong).toBeGreaterThanOrEqual(2)
    expect(vars.answers[0]).toMatchObject({ answer: { choice_id: 'c' } }) // the "32" answer: joining, not adding
    expect(vars.answers[0]!.students).toBeGreaterThan(vars.answers[1]?.students ?? 0)
    expect(JSON.stringify(rows)).not.toMatch(/correctChoiceId|accepted|correctOrder/)
    await as(SEED_STUDENT_1)
    await fails('select public.get_class_misconceptions($1)', [P1], /Not allowed/)
    await as(null)
    await fails('select public.get_class_misconceptions($1)', [P1], /permission denied/)
  })
})
describe.skipIf(!up)('my notebook', () => {
  type Note = { activity_id: string; activity_title: string; lesson_title: string; module_title: string; body: string }

  it('saves, updates and deletes your own note, and lists it with its titles', async () => {
    await as(SEED_STUDENT_1)
    await q('select public.save_note($1, $2)', [ACT(2), '  A loop repeats the lines inside it.  '])
    await q('select public.save_note($1, $2)', [ACT(1), 'A variable is a name for a value.'])
    let notes = await one<Note[]>('select public.get_my_notes() as r')
    expect(notes.map((n) => n.activity_id)).toEqual([ACT(1), ACT(2)]) // course order, not save order
    expect(notes[1]).toMatchObject({ body: 'A loop repeats the lines inside it.' })
    expect(notes[0]!.activity_title.length).toBeGreaterThan(0)
    await q('select public.save_note($1, $2)', [ACT(1), 'Changed my mind.'])
    await q('select public.save_note($1, $2)', [ACT(2), '   '])
    notes = await one<Note[]>('select public.get_my_notes() as r')
    expect(notes).toEqual([expect.objectContaining({ activity_id: ACT(1), body: 'Changed my mind.' })])
  })

  it('is private: classmates, instructors and admins cannot read it, and nobody reads the table', async () => {
    await as(SEED_STUDENT_1)
    await q('select public.save_note($1, $2)', [ACT(1), 'Private thought'])
    await as(SEED_STUDENT_2)
    expect(await one<Note[]>('select public.get_my_notes() as r')).toEqual([])
    await fails('select * from public.student_notes', [], /permission denied/)
    const admin = await mkUser('cic_admin')
    await as(admin)
    expect(await one<Note[]>('select public.get_my_notes() as r')).toEqual([])
    await fails('select * from public.student_notes', [], /permission denied/)
    await fails('select public.save_note($1, $2)', [ACT(1), 'x'], /Only students/)
  })

  it('refuses long notes, unknown activities and signed-out callers', async () => {
    await as(SEED_STUDENT_1)
    await fails('select public.save_note($1, $2)', [ACT(1), 'x'.repeat(2001)], /under 2000/)
    await fails('select public.save_note($1, $2)', [randomUUID(), 'x'], /Activity not found/)
    await as(null)
    await fails('select public.get_my_notes()', [], /permission denied/)
  })
})

describe.skipIf(!up)('AI-drafted pre-test and post-test', () => {
  // The exact shape the studio sends after "Draft both tests with AI" (shared/authoring/draftTests.ts
  // toAssessments, then toDraftPayload): question ids ai-pre-p1 / ai-post-p1, rotated choices, keys.
  const item = (kind: 'pre' | 'post', n: number) => ({
    pair_key: `p${n}`, concept_id: 'loops', question_id: `ai-${kind}-p${n}`,
    content: { id: `ai-${kind}-p${n}`, conceptId: 'loops', type: 'mcq', prompt: `How many times does \`for i in range(${n + 2}):\` run?`, choices: [{ id: 'a', text: '0' }, { id: 'b', text: String(n + 2) }, { id: 'c', text: '1' }] },
    key: { type: 'mcq', correctChoiceId: 'b', hints: [] },
  })

  it('save through save_module_draft as paired, keyed items like hand-written ones', async () => {
    const author = await mkUser('instructor', { author: true })
    await as(author)
    const payload = {
      slug: `ai-${randomUUID().slice(0, 8)}`, title: 'Loops from a video', summary: '',
      lessons: [{ title: 'Loops', activities: [{ kind: 'reading', title: 'R', required: true, concept_id: 'loops', content: { body: 'for loops' }, keys: [] }] }],
      assessments: (['pre', 'post'] as const).map((kind) => ({ kind, title: `Loops from a video ${kind}-test`, items: [1, 2, 3].map((n) => item(kind, n)) })),
    }
    const moduleId = await one<string>('select public.save_module_draft($1::jsonb) as r', [JSON.stringify(payload)])
    await asSuper()
    const items = await q<{ kind: string; pair_key: string; has_key: boolean }>(
      `select a.kind, i.pair_key, exists (select 1 from assessment_keys k where k.assessment_item_id = i.id) as has_key
       from assessments a join assessment_items i on i.assessment_id = a.id where a.module_id = $1 order by a.kind, i.position`, [moduleId])
    expect(items.filter((i) => i.kind === 'pre').map((i) => i.pair_key)).toEqual(['p1', 'p2', 'p3'])
    expect(items.filter((i) => i.kind === 'post').map((i) => i.pair_key)).toEqual(['p1', 'p2', 'p3'])
    expect(items.every((i) => i.has_key)).toBe(true)
  })
})
