// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { SourcesCache } from '../sources/handler'
import { handleSimplify } from './handler'

const ACT = '50000000-0000-4000-8000-000000000004'
const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon-key', AI_GATEWAY_URL: 'https://ai.test/v1', AI_GATEWAY_KEY: 'k' }
const READING = { activity_id: ACT, title: 'Repeating with loops', kind: 'reading', content: { body: 'A loop repeats a block of code. for n in range(3): print(n) prints 0, 1 and 2.' } }
const GOOD = {
  summary: 'A loop does the same thing again and again.',
  explanation: 'A **loop** repeats steps.\n\n1. Clap.\n2. Clap.\n3. Clap.',
  example: 'Clap 3 times.',
  keyTerms: [{ term: 'loop', meaning: 'doing something again' }],
  checkQuestion: { question: 'If you clap in a loop 3 times, how many claps?', answer: '3' },
}

function setup(opts: { activity?: unknown; activityStatus?: number; ai?: unknown } = {}) {
  const calls: { url: string; auth?: string; body: string }[] = []
  const store = new Map<string, unknown>()
  const cache: SourcesCache = { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v) } }
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({ url, auth: headers.get('authorization') ?? undefined, body: String(init?.body ?? '') })
    if (url.endsWith('/rpc/get_activity')) return Response.json(opts.activity ?? READING, { status: opts.activityStatus ?? 200 })
    if (url.startsWith('https://ai.test')) return Response.json({ choices: [{ message: { content: typeof opts.ai === 'string' ? opts.ai : JSON.stringify(opts.ai ?? GOOD) } }] })
    return new Response('{}', { status: 404 })
  }
  const run = (body: unknown, token: string | null = 'student-token', env: Record<string, string> = ENV) =>
    handleSimplify(new Request('https://x/api/simplify', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) }), env, { fetch, cache })
  return { calls, run, aiCalls: () => calls.filter((c) => c.url.startsWith('https://ai.test')) }
}

describe('POST /api/simplify', () => {
  it('rewrites a reading for the grade, loading it with the student token and sending the rubric and material', async () => {
    const t = setup()
    const res = await t.run({ activity_id: ACT, grade: 4 })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ grade: 4, source: 'ai', summary: GOOD.summary, keyTerms: GOOD.keyTerms })
    expect(t.calls.find((c) => c.url.endsWith('/rpc/get_activity'))!.auth).toBe('Bearer student-token')
    const prompt = t.aiCalls()[0]!.body
    expect(prompt).toContain('grade 4')
    expect(prompt).toContain('A loop repeats a block of code.')
    expect(prompt).toContain('running laps around a track') // the loops example for grades 3-5
    expect(prompt).not.toContain('student-token')
  })

  it('serves the same activity and grade from the cache without asking the AI again', async () => {
    const t = setup()
    await t.run({ activity_id: ACT, grade: 4 })
    const again = await t.run({ activity_id: ACT, grade: 4 })
    expect(await again.json()).toMatchObject({ source: 'cache' })
    expect(t.aiCalls()).toHaveLength(1)
    await t.run({ activity_id: ACT, grade: 9 }) // another grade is another rewrite
    expect(t.aiCalls()).toHaveLength(2)
  })

  it('gives grades 1 and 2 no glossary', async () => {
    const res = await setup().run({ activity_id: ACT, grade: 1 })
    expect(await res.json()).toMatchObject({ keyTerms: [] })
  })

  it('lets a guest use it with the public key (open lessons only, enforced by get_activity)', async () => {
    const t = setup()
    expect((await t.run({ activity_id: ACT, grade: 6 }, null)).status).toBe(200)
    expect(t.calls[0]!.auth).toBe('Bearer anon-key')
  })

  it('refuses a locked or foreign activity, a question activity, and too little material', async () => {
    expect((await setup({ activityStatus: 400 }).run({ activity_id: ACT, grade: 5 })).status).toBe(403)
    expect((await setup({ activityStatus: 401 }).run({ activity_id: ACT, grade: 5 })).status).toBe(401)
    expect((await setup({ activity: { ...READING, kind: 'check', content: { questions: [] } } }).run({ activity_id: ACT, grade: 5 })).status).toBe(400)
    expect((await setup({ activity: { ...READING, content: { body: 'Short.' } } }).run({ activity_id: ACT, grade: 5 })).status).toBe(422)
  })

  it('checks the request: grade 1 to 12, a real id, no extra fields, small body', async () => {
    const t = setup()
    for (const bad of [{ activity_id: ACT, grade: 0 }, { activity_id: ACT, grade: 13 }, { activity_id: 'x', grade: 3 }, { activity_id: ACT, grade: 3, text: 'anything' }]) {
      expect((await t.run(bad)).status).toBe(400)
    }
    expect((await t.run('{bad')).status).toBe(400)
    expect((await t.run('x'.repeat(2000))).status).toBe(413)
    expect(t.aiCalls()).toHaveLength(0)
  })

  it('is 503 without an AI provider and 502 when the AI reply is unusable', async () => {
    expect((await setup().run({ activity_id: ACT, grade: 3 }, 'tok', { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'a' })).status).toBe(503)
    expect((await setup({ ai: 'not json' }).run({ activity_id: ACT, grade: 3 })).status).toBe(502)
    expect((await setup({ ai: { summary: 'only this' } }).run({ activity_id: ACT, grade: 3 })).status).toBe(502)
  })
})
