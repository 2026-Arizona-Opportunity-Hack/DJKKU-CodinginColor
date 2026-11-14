// Per-role tests for supabase/migrations/lane_c_proposal.sql, run on PGlite
// (real Postgres compiled to WASM, so RLS is the real thing and no Docker needed).
//
// The helpers lane A will provide (is_admin, is_staff, auth.uid) are STUBBED
// here from two session settings: app.uid and app.role. When lane A's real
// schema lands, point this file at their migrations and delete the stubs.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const proposal = readFileSync(new URL('../migrations/lane_c_proposal.sql', import.meta.url), 'utf8')

const STUBS = `
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create function is_admin() returns boolean language sql stable as $$ select current_setting('app.role', true) = 'admin' $$;
create function is_staff() returns boolean language sql stable as $$ select current_setting('app.role', true) in ('admin','instructor') $$;
create table assessment_results (student_id uuid, class_id uuid, assessment_id uuid, score_pct numeric);
create role app_user nologin;
`

const ADMIN = '00000000-0000-0000-0000-0000000000a1'
const INS_A = '00000000-0000-0000-0000-0000000000b1'
const INS_B = '00000000-0000-0000-0000-0000000000b2'
const STUDENT = '00000000-0000-0000-0000-0000000000c1'
const REVIEWER = '00000000-0000-0000-0000-0000000000d1'

let db: PGlite

/** Run fn as a given user and role, with RLS enforced (app_user is not a superuser). */
async function as<T>(uid: string, role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role app_user; select set_config('app.uid','${uid}',false), set_config('app.role','${role}',false)`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}
const count = async (table: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUBS)
  await db.exec(proposal)
  await db.exec('grant usage on schema public, auth to app_user; grant all on all tables in schema public to app_user')
  // Fixture, inserted as superuser: A's draft module and a published module,
  // each with a lesson, an activity, a key, a pre and post test.
  await db.exec(`
    insert into concepts values ('loops','Loops');
    insert into modules (id, slug, title, status, created_by) values
      ('11111111-1111-1111-1111-111111111111','draft-mod','Draft','draft','${INS_A}'),
      ('22222222-2222-2222-2222-222222222222','pub-mod','Published','published','${ADMIN}');
    insert into lessons (id, module_id, position, title) values
      ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',0,'L'),
      ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',0,'L');
    insert into activities (id, lesson_id, position, kind, title, content) values
      ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002',0,'check','A','{}');
    insert into activity_keys values ('bbbbbbbb-0000-0000-0000-000000000001','q1','{"type":"mcq","correctChoiceId":"a"}');
    insert into assessments (id, module_id, kind) values
      ('cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','pre'),
      ('cccccccc-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','post');
    insert into assessment_items (assessment_id, pair_key, concept_id, question_id, content, key)
      values ('cccccccc-0000-0000-0000-000000000001','p1','loops','q1','{}','{"secret":true}');
  `)
})
afterAll(() => db.close())

describe('answer key isolation', () => {
  it('a student cannot read any key', async () => {
    await as(STUDENT, 'student', async () => {
      expect(await count('activity_keys')).toBe(0)
      expect(await count('assessment_items')).toBe(0)
    })
  })
  it('a reviewer cannot read keys either', async () => {
    await as(REVIEWER, 'reviewer', async () => {
      expect(await count('activity_keys')).toBe(0)
      expect(await count('assessment_items')).toBe(0)
    })
  })
  it('staff can read keys', async () => {
    await as(INS_A, 'instructor', async () => expect(await count('activity_keys')).toBe(1))
  })
})

describe('reviewer is read-only', () => {
  it('cannot write modules, lessons, activities or keys', async () => {
    await as(REVIEWER, 'reviewer', async () => {
      await expect(db.exec(`insert into modules (slug,title,created_by) values ('x','x','${REVIEWER}')`)).rejects.toThrow()
      await expect(db.exec(`insert into lessons (module_id,position,title) values ('22222222-2222-2222-2222-222222222222',5,'x')`)).rejects.toThrow()
      await expect(db.exec(`insert into activity_keys values ('bbbbbbbb-0000-0000-0000-000000000001','q9','{}')`)).rejects.toThrow()
    })
    // updates and deletes match zero rows (no policy), so nothing changes
    await as(REVIEWER, 'reviewer', async () => {
      await db.exec(`update modules set title = 'hacked'; delete from lessons`)
    })
    expect(await count('lessons')).toBe(2)
    expect((await db.query<{ title: string }>(`select title from modules where slug='pub-mod'`)).rows[0]!.title).toBe('Published')
  })
})

describe('draft visibility', () => {
  it('students see published content only', async () => {
    await as(STUDENT, 'student', async () => {
      const r = await db.query<{ slug: string }>('select slug from modules')
      expect(r.rows.map((x) => x.slug)).toEqual(['pub-mod'])
      expect(await count('lessons')).toBe(1) // the draft module's lesson is hidden too
      expect(await count('activities')).toBe(1)
      expect(await count('assessments')).toBe(2)
    })
  })
  it('an author sees their own draft, another instructor does not, an admin sees all', async () => {
    await as(INS_A, 'instructor', async () => expect(await count('modules')).toBe(2))
    await as(INS_B, 'instructor', async () => expect(await count('modules')).toBe(1))
    await as(ADMIN, 'admin', async () => expect(await count('modules')).toBe(2))
  })
})

describe('authoring and publishing rules', () => {
  it('students cannot create modules', async () => {
    await as(STUDENT, 'student', async () => {
      await expect(db.exec(`insert into modules (slug,title,created_by) values ('s','s','${STUDENT}')`)).rejects.toThrow()
    })
  })
  it('an instructor can only insert a draft that they own', async () => {
    await as(INS_B, 'instructor', async () => {
      await expect(db.exec(`insert into modules (slug,title,status,created_by) values ('p','p','published','${INS_B}')`)).rejects.toThrow()
      await expect(db.exec(`insert into modules (slug,title,created_by) values ('o','o','${INS_A}')`)).rejects.toThrow()
      await db.exec(`insert into modules (slug,title,created_by) values ('mine','mine','${INS_B}')`)
    })
  })
  it('an instructor can submit but cannot publish; an admin can', async () => {
    await as(INS_A, 'instructor', async () => {
      await db.exec(`update modules set status='submitted' where slug='draft-mod'`)
      await expect(db.exec(`update modules set status='published' where slug='draft-mod'`)).rejects.toThrow()
    })
    await as(ADMIN, 'admin', async () => {
      await db.exec(`update modules set status='published' where slug='draft-mod'`)
    })
    // restore the fixture so later tests are independent
    await db.exec(`update modules set status='draft' where slug='draft-mod'`)
  })
  it('published modules are frozen: no edits to lessons, even by staff', async () => {
    await as(ADMIN, 'admin', async () => {
      await expect(db.exec(`insert into lessons (module_id,position,title) values ('22222222-2222-2222-2222-222222222222',9,'x')`)).rejects.toThrow()
      await db.exec(`update lessons set title='changed' where module_id='22222222-2222-2222-2222-222222222222'`)
    })
    expect((await db.query<{ title: string }>(`select title from lessons where position=0 and module_id='22222222-2222-2222-2222-222222222222'`)).rows[0]!.title).toBe('L')
  })
  it('an author can edit lessons of their own draft', async () => {
    await as(INS_A, 'instructor', async () => {
      await db.exec(`insert into lessons (module_id,position,title) values ('11111111-1111-1111-1111-111111111111',1,'new')`)
    })
  })
})

describe('v_learning_gain matches ADR 0020', () => {
  it('complete, pre of 100 and missing post', async () => {
    const [S1, S2, S3, CLS] = ['1', '2', '3', '4'].map((n) => `00000000-0000-0000-0000-00000000000${n}`)
    await db.exec(`
      insert into assessment_results values
        ('${S1}','${CLS}','cccccccc-0000-0000-0000-000000000001',40),
        ('${S1}','${CLS}','cccccccc-0000-0000-0000-000000000002',70),
        ('${S2}','${CLS}','cccccccc-0000-0000-0000-000000000001',100),
        ('${S2}','${CLS}','cccccccc-0000-0000-0000-000000000002',100),
        ('${S3}','${CLS}','cccccccc-0000-0000-0000-000000000001',50);
    `)
    const rows = (await db.query<{ student_id: string; gain_points: string | null; normalized_gain: string | null; status: string }>(
      'select * from v_learning_gain order by student_id',
    )).rows
    const [a, b, c] = rows
    expect([a!.status, Number(a!.gain_points), Number(a!.normalized_gain)]).toEqual(['complete', 30, 0.5])
    expect([b!.status, Number(b!.gain_points), b!.normalized_gain]).toEqual(['complete', 0, null])
    expect([c!.status, c!.gain_points, c!.normalized_gain]).toEqual(['incomplete', null, null]) // never a fake zero
  })
})
