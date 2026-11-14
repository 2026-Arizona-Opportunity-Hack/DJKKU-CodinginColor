import { describe, expect, it } from 'vitest'
import { handleCompletion, handleLearningGain, type ApiDeps } from './handler'
import type { ApiDataSource, ApiKeyInfo, ClassGainRow, ClassProgressRow } from './source'

const PROGRESS_KEY = 'oh_progress_key_aaaaaaaaaaaaaaaaaaaa'
const ASSESS_KEY = 'oh_assess_key_bbbbbbbbbbbbbbbbbbbbbbb'

const keys: Record<string, ApiKeyInfo> = {
  [PROGRESS_KEY]: { apiKeyId: 'k1', scope: ['progress'] },
  [ASSESS_KEY]: { apiKeyId: 'k2', scope: ['assessments'] },
  // 'oh_revoked...' is simply absent: the database answers null for revoked keys.
}

const progressRows: ClassProgressRow[] = [
  { class_id: 'a', class_name: 'Period 3', term: '2026 Fall', school_name: 'Maryvale', students: 24, avg_completion_pct: 62.5 },
  { class_id: 'b', class_name: '=HYPERLINK("evil")', term: '2026 Fall', school_name: 'Maryvale', students: 8, avg_completion_pct: 30 },
]

const gainRows: ClassGainRow[] = [
  {
    class_id: 'a', class_name: 'Period 3', term: '2026 Fall', school_name: 'Maryvale',
    module_id: 'm1', module_title: 'Variables and Loops', concept_id: 'loops', concept_name: 'Loops',
    pre_pct: 41.2, post_pct: 73.5, gain_points: 32.3, normalized_gain: 0.55,
    complete_count: 18, incomplete_count: 6,
  },
]

function source(over: Partial<ApiDataSource> = {}): ApiDataSource {
  return {
    validateKey: async (raw) => keys[raw] ?? null,
    classProgress: async () => progressRows,
    classGain: async () => gainRows,
    ...over,
  }
}

const NOW = new Date('2026-11-15T17:30:00Z')
const deps = (over: Partial<ApiDataSource> = {}): ApiDeps => ({ data: source(over), now: () => NOW })

function get(path: string, key?: string): Request {
  return new Request(`https://app.example${path}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })
}

async function body(res: Response) {
  return (await res.json()) as Record<string, any>
}

describe('authentication', () => {
  it('answers 401 with no key, and names the scheme', async () => {
    const res = await handleCompletion(get('/api/v1/completion'), deps())
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect((await body(res)).error.code).toBe('unauthorized')
  })

  it('answers 401 for an unknown or revoked key, with the same message as a missing one', async () => {
    const missing = await body(await handleCompletion(get('/api/v1/completion'), deps()))
    const unknown = await body(await handleCompletion(get('/api/v1/completion', 'oh_revoked_cccccccccccccccccccc'), deps()))
    expect(unknown).toEqual(missing)
  })

  it('answers 403 when the key lacks the scope', async () => {
    const res = await handleCompletion(get('/api/v1/completion', ASSESS_KEY), deps())
    expect(res.status).toBe(403)
    expect((await body(res)).error.code).toBe('forbidden')
    const res2 = await handleLearningGain(get('/api/v1/learning-gain', PROGRESS_KEY), deps())
    expect(res2.status).toBe(403)
  })

  it('checks the key before the parameters, so a stranger learns nothing', async () => {
    const res = await handleCompletion(get('/api/v1/completion?group_by=nonsense'), deps())
    expect(res.status).toBe(401)
  })

  it('answers 503, not 500, when the key check itself cannot run', async () => {
    const res = await handleCompletion(
      get('/api/v1/completion', PROGRESS_KEY),
      deps({ validateKey: async () => { throw new Error('connection refused to db.internal:5432') } }),
    )
    expect(res.status).toBe(503)
    expect(JSON.stringify(await body(res))).not.toContain('db.internal')
  })

  it('never echoes the key back', async () => {
    const res = await handleCompletion(get('/api/v1/completion', PROGRESS_KEY), deps())
    expect(JSON.stringify(await body(res))).not.toContain(PROGRESS_KEY)
  })
})

describe('GET /api/v1/completion', () => {
  it('returns class rows with the response envelope', async () => {
    const res = await handleCompletion(get('/api/v1/completion', PROGRESS_KEY), deps())
    expect(res.status).toBe(200)
    const json = await body(res)
    expect(json.api_version).toBe('v1')
    expect(json.as_of).toBe('2026-11-15T17:30:00.000Z')
    expect(json.rows[0]).toEqual({
      cohort: 'Maryvale 2026 Fall',
      class: '=HYPERLINK("evil")',
      students: 8,
      avg_completion_pct: 30,
    })
    expect(json.rows).toHaveLength(2)
  })

  it('is never cached by a browser or proxy', async () => {
    const res = await handleCompletion(get('/api/v1/completion', PROGRESS_KEY), deps())
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('rolls up to cohort', async () => {
    const res = await handleCompletion(get('/api/v1/completion?group_by=cohort', PROGRESS_KEY), deps())
    const json = await body(res)
    expect(json.rows).toEqual([
      // (24 x 62.5 + 8 x 30) / 32 = 54.375, each class weighted by its size.
      { cohort: 'Maryvale 2026 Fall', class: null, students: 32, avg_completion_pct: 54.38 },
    ])
  })

  it('does not return a class the source wrongly included with fewer than 5 students', async () => {
    const res = await handleCompletion(
      get('/api/v1/completion', PROGRESS_KEY),
      deps({ classProgress: async () => [{ ...progressRows[0], students: 3 }] }),
    )
    expect((await body(res)).rows).toEqual([])
  })

  it('rejects an unknown group_by, an unknown parameter and a bad format with 400', async () => {
    for (const q of ['group_by=school', 'from=2026-01-01', 'format=xml', 'cohort=']) {
      const res = await handleCompletion(get(`/api/v1/completion?${q}`, PROGRESS_KEY), deps())
      expect(res.status, q).toBe(400)
      expect((await body(res)).error.code).toBe('invalid_parameter')
    }
  })

  it('answers 503 with a generic message when the data source fails', async () => {
    const res = await handleCompletion(
      get('/api/v1/completion', PROGRESS_KEY),
      deps({ classProgress: async () => { throw new Error('secret-detail') } }),
    )
    expect(res.status).toBe(503)
    expect(JSON.stringify(await body(res))).not.toContain('secret-detail')
  })

  it('returns CSV with the same columns, and keeps a class name from running as a formula', async () => {
    const res = await handleCompletion(get('/api/v1/completion?format=csv', PROGRESS_KEY), deps())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const lines = (await res.text()).trim().split('\r\n')
    expect(lines[0]).toBe('cohort,class,students,avg_completion_pct')
    // Rows are sorted by class name, and "=" sorts before "P".
    // A cell that starts with = would run as a formula in a spreadsheet, so it is
    // prefixed with a quote and stays plain text.
    expect(lines[1]).toContain(`"'=HYPERLINK(""evil"")"`)
    expect(lines[2]).toBe('Maryvale 2026 Fall,Period 3,24,62.5')
  })
})

describe('GET /api/v1/learning-gain', () => {
  it('returns names, counts and the gain numbers', async () => {
    const res = await handleLearningGain(get('/api/v1/learning-gain', ASSESS_KEY), deps())
    expect(res.status).toBe(200)
    expect((await body(res)).rows).toEqual([
      {
        cohort: 'Maryvale 2026 Fall',
        class: 'Period 3',
        module: 'Variables and Loops',
        concept: 'Loops',
        complete_count: 18,
        incomplete_count: 6,
        pre_pct: 41.2,
        post_pct: 73.5,
        gain_points: 32.3,
        // Worked out from the class means: 32.3 / (100 - 41.2) = 0.549.
        normalized_gain: 0.549,
      },
    ])
  })

  it('leaves out a group under 5 complete students', async () => {
    const res = await handleLearningGain(
      get('/api/v1/learning-gain', ASSESS_KEY),
      deps({ classGain: async () => [{ ...gainRows[0], complete_count: 4 }] }),
    )
    expect((await body(res)).rows).toEqual([])
  })

  it('exports CSV with blank cells for a missing normalized gain, never a zero', async () => {
    const res = await handleLearningGain(
      get('/api/v1/learning-gain?format=csv', ASSESS_KEY),
      deps({ classGain: async () => [{ ...gainRows[0], pre_pct: 100, post_pct: 100 }] }),
    )
    const lines = (await res.text()).trim().split('\r\n')
    expect(lines[0]).toBe(
      'cohort,class,module,concept,complete_count,incomplete_count,pre_pct,post_pct,gain_points,normalized_gain',
    )
    expect(lines[1].endsWith(',100,100,0,')).toBe(true)
  })

  it('filters by cohort', async () => {
    const res = await handleLearningGain(get('/api/v1/learning-gain?cohort=Somewhere%20Else', ASSESS_KEY), deps())
    expect((await body(res)).rows).toEqual([])
  })
})
