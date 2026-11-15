import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GATEWAY_MODEL, handleHint, MODEL, type HintEnv } from './handler'

const BASE = 'https://proj.supabase.co'
const ENV: HintEnv = { SUPABASE_URL: BASE, SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', GEMINI_API_KEY: 'gemini-key' }
const ACT = '30000000-0000-4000-8000-000000000001'
const USER = '9f0c1d2e-0000-4000-8000-0000000000aa'
const CLASS = '11000000-0000-4000-8000-000000000001'
const TOKEN = 'student-access-token-xyz'

const QUESTIONS = [
  { type: 'mcq', id: 'q1', prompt: 'Which repeats code?', conceptId: 'loops', choices: [{ id: 'a', text: 'A loop' }, { id: 'b', text: 'A variable' }] },
]
const KEYS = [{ question_id: 'q1', key: { type: 'mcq', correctChoiceId: 'a', hints: ['Think about repeating', 'Look at the word for'] } }]
const WRONG = { answers: { q1: { choice_id: 'b' } } }

interface World {
  authOk: boolean
  activityOk: boolean
  kind: string
  used: number
  cache: { hint: string }[]
  gemini: (init: RequestInit) => Promise<Response> | Response
  gateway: (init: RequestInit) => Promise<Response> | Response
  seat: { class_id: string }[]
}
let world: World
let calls: { url: string; init?: RequestInit }[]

const geminiSays = (text: string) => () => Response.json({ candidates: [{ content: { parts: [{ text }] } }] })
const gatewaySays = (content: string | null) => () => Response.json({ choices: [{ message: { role: 'assistant', content } }] })

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  calls.push({ url, init })
  if (url.startsWith('https://generativelanguage.googleapis.com')) return world.gemini(init!)
  if (url.startsWith('https://ai.gateway.test/')) return world.gateway(init!)
  if (url === `${BASE}/auth/v1/user`) return world.authOk ? Response.json({ id: USER }) : new Response('{}', { status: 401 })
  if (url.endsWith('/rpc/get_activity')) return world.activityOk ? Response.json({ kind: world.kind, content: { questions: QUESTIONS } }) : new Response('{}', { status: 400 })
  if (url.includes('/hint_events?')) return Response.json(Array.from({ length: world.used }, (_, i) => ({ id: String(i) })))
  if (url.includes('/activity_keys?')) return Response.json(KEYS)
  if (url.includes('/hint_cache?')) return Response.json(world.cache)
  if (url.includes('/class_members?')) return Response.json(world.seat)
  return new Response(null, { status: 201 }) // inserts
}) as typeof fetch

const post = (body: unknown, token: string | null = TOKEN) =>
  new Request('https://site.test/api/hint', { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const run = (body: unknown = { activity_id: ACT, response: WRONG }, token: string | null = TOKEN, env: HintEnv = ENV) => handleHint(post(body, token), env, { fetch: fakeFetch })
const geminiCalls = () => calls.filter((c) => c.url.includes('generativelanguage'))
const inserts = (table: string) => calls.filter((c) => c.init?.method === 'POST' && c.url.endsWith(`/rest/v1/${table}`))

beforeEach(() => {
  world = { authOk: true, activityOk: true, kind: 'check', used: 0, cache: [], gemini: geminiSays('Look at the word that means doing something again and again.'), gateway: gatewaySays('What word means doing a thing over and over?'), seat: [{ class_id: CLASS }] }
  calls = []
  vi.restoreAllMocks()
})

describe('who may ask', () => {
  it('answers 400 for a body that is not valid, without calling anyone', async () => {
    for (const bad of ['not json', {}, { activity_id: 'nope', response: {} }, { activity_id: ACT, response: 'x' }, { activity_id: ACT, response: WRONG, extra: 1 }, { activity_id: ACT, response: { text: 'x'.repeat(5000) } }]) {
      expect((await run(bad)).status).toBe(400)
    }
    expect(calls).toHaveLength(0)
  })

  it('answers 413 for an oversized body before parsing it', async () => {
    expect((await run({ activity_id: ACT, response: { text: 'x'.repeat(20_000) } })).status).toBe(413)
    expect(calls).toHaveLength(0)
  })

  it('answers 401 with no token, and with a token Supabase does not know', async () => {
    expect((await run(undefined, null)).status).toBe(401)
    world.authOk = false
    expect((await run()).status).toBe(401)
    expect(geminiCalls()).toHaveLength(0)
  })

  it('answers 403 when get_activity refuses (locked, or not in this class), and never reaches the model', async () => {
    world.activityOk = false
    expect((await run()).status).toBe(403)
    expect(geminiCalls()).toHaveLength(0)
    expect(calls.some((c) => c.url.includes('activity_keys'))).toBe(false)
  })

  it('asks get_activity with the STUDENT token, not the service role', async () => {
    await run()
    const rpc = calls.find((c) => c.url.endsWith('/rpc/get_activity'))!
    expect((rpc.init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    const keyRead = calls.find((c) => c.url.includes('activity_keys'))!
    expect((keyRead.init!.headers as Record<string, string>).Authorization).toBe('Bearer service-key')
  })

  it('is 503 when the server is not configured', async () => {
    expect((await run(undefined, TOKEN, { ...ENV, SUPABASE_ANON_KEY: undefined })).status).toBe(503)
  })
})

describe('the hint', () => {
  it('stops at 3 hints with 429', async () => {
    world.used = 3
    const res = await run()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(geminiCalls()).toHaveLength(0)
  })

  it('serves a cached hint without calling the model', async () => {
    world.cache = [{ hint: 'Cached nudge.' }]
    const res = await run()
    expect(await res.json()).toEqual({ hint: 'Cached nudge.', source: 'cache', remaining: 2 })
    expect(geminiCalls()).toHaveLength(0)
    expect(inserts('hint_events')).toHaveLength(1)
  })

  it('uses the model, caches the hint and logs it', async () => {
    const res = await run()
    expect(await res.json()).toEqual({ hint: 'Look at the word that means doing something again and again.', source: 'ai', remaining: 2 })
    expect(geminiCalls()).toHaveLength(1)
    expect(geminiCalls()[0]!.url).toContain(`/models/${MODEL}:generateContent`)
    expect(JSON.parse(String(inserts('hint_cache')[0]!.init!.body))).toMatchObject({ activity_id: ACT, hint: expect.stringContaining('again and again') })
    expect(JSON.parse(String(inserts('hint_events')[0]!.init!.body))).toEqual({
      student_id: USER, class_id: CLASS, activity_id: ACT, attempt: 1, hint: expect.any(String), concept_id: 'loops',
    })
  })

  it('counts attempts and remaining from the hints already used', async () => {
    world.used = 2
    const res = await run()
    expect((await res.json()).remaining).toBe(0)
    expect(JSON.parse(String(inserts('hint_events')[0]!.init!.body)).attempt).toBe(3)
  })

  it.each([
    ['gives the answer away', 'The answer is a loop.'],
    ['gives it away in other words', 'Try A LOOP, with a capital letter!'],
    ['is too long', 'Think about it. '.repeat(30)],
    ['is empty', ''],
  ])('falls back to the written ladder when the model output %s', async (_why, text) => {
    world.gemini = geminiSays(text)
    const res = await run()
    expect(await res.json()).toEqual({ hint: 'Think about repeating', source: 'ladder', remaining: 2 })
    expect(inserts('hint_cache')).toHaveLength(0) // a rejected hint is never cached
  })

  it.each([
    ['a timeout', () => { throw new DOMException('The operation timed out', 'TimeoutError') }],
    ['a network failure', () => { throw new TypeError('fetch failed') }],
    ['a 429 from Gemini', () => new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 })],
    ['a 500 from Gemini', () => new Response('oops', { status: 500 })],
    ['an unexpected body', () => Response.json({ nope: true })],
  ])('falls back to the ladder on %s, and never returns a 5xx', async (_why, gemini) => {
    world.gemini = gemini
    const res = await run()
    expect(res.status).toBe(200)
    expect((await res.json()).source).toBe('ladder')
  })

  it('uses the next unused rung, and a plain sentence once the ladder runs out', async () => {
    world.gemini = () => new Response('x', { status: 500 })
    world.used = 1
    expect((await (await run()).json()).hint).toBe('Look at the word for')
    world.used = 2
    expect((await (await run()).json()).hint).toBe('Re-read the question and try one part at a time.')
  })

  it('works without a Gemini key, using the ladder', async () => {
    const res = await run(undefined, TOKEN, { ...ENV, GEMINI_API_KEY: undefined })
    expect((await res.json()).source).toBe('ladder')
    expect(geminiCalls()).toHaveLength(0)
  })

  it('still answers if the database cannot log the hint', async () => {
    world.seat = []
    const res = await run()
    expect(res.status).toBe(200)
    expect(inserts('hint_events')).toHaveLength(0)
  })

  it('is 400 for an activity that has no scored questions to hint about', async () => {
    world.kind = 'reading'
    expect((await run()).status).toBe(400)
  })
})

describe('privacy', () => {
  it('sends the model only the question and the answer: no user id, class, name or token', async () => {
    await run()
    const sent = geminiCalls()[0]!
    const headers = sent.init!.headers as Record<string, string>
    const body = String(sent.init!.body)
    expect(Object.keys(headers).sort()).toEqual(['Content-Type', 'x-goog-api-key'])
    for (const secret of [USER, CLASS, TOKEN, 'service-key', 'anon-key', 'q1', ACT]) expect(body + sent.url).not.toContain(secret)
    expect(body).toContain('Which repeats code?')
    expect(body).toContain('The student answered: A variable')
    expect(body).not.toMatch(/correctChoiceId|hints|"a"/) // not the key
  })

  it('never logs the token, the answer or the key', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await run()
    await run(undefined, null)
    const logged = log.mock.calls.flat().join(' ')
    expect(log).toHaveBeenCalled()
    for (const secret of [TOKEN, 'service-key', 'gemini-key', 'A variable', 'Think about repeating', 'choice_id']) expect(logged).not.toContain(secret)
    expect(logged).toMatch(/"source":"ai"/)
  })

  it('marks the answer as private and not cacheable by browsers', async () => {
    expect((await run()).headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('the OHack AI gateway (OpenAI-style)', () => {
  const GW: HintEnv = { ...ENV, AI_GATEWAY_URL: 'https://ai.gateway.test/v1/', AI_GATEWAY_KEY: 'gateway-key' }
  const gatewayCalls = () => calls.filter((c) => c.url.startsWith('https://ai.gateway.test/'))

  it('is used instead of Gemini when set, with gpt-oss-120b by default', async () => {
    const res = await run(undefined, TOKEN, GW)
    expect(await res.json()).toEqual({ hint: 'What word means doing a thing over and over?', source: 'ai', remaining: 2 })
    expect(geminiCalls()).toHaveLength(0)
    const sent = gatewayCalls()[0]!
    expect(sent.url).toBe('https://ai.gateway.test/v1/chat/completions')
    const body = JSON.parse(String(sent.init!.body))
    expect(body.model).toBe(GATEWAY_MODEL)
    expect(body.model).toBe('gpt-oss-120b')
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user'])
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model']) // only standard fields
    expect((sent.init!.headers as Record<string, string>).Authorization).toBe('Bearer gateway-key')
    expect(inserts('hint_cache')).toHaveLength(1)
  })

  it('uses AI_MODEL when set', async () => {
    await run(undefined, TOKEN, { ...GW, AI_MODEL: 'kimi-k2.7-code' })
    expect(JSON.parse(String(gatewayCalls()[0]!.init!.body)).model).toBe('kimi-k2.7-code')
  })

  it('sends only the question and the answer: no user id, class, name, token or other keys', async () => {
    await run(undefined, TOKEN, GW)
    const sent = gatewayCalls()[0]!
    const text = String(sent.init!.body) + sent.url + JSON.stringify(sent.init!.headers)
    for (const secret of [USER, CLASS, TOKEN, 'service-key', 'anon-key', 'gemini-key', 'q1', ACT]) expect(text).not.toContain(secret)
    expect(text).toContain('The student answered: A variable')
    expect(text).not.toMatch(/correctChoiceId|hints/)
  })

  it.each([
    ['gives the answer away', gatewaySays('The answer is a loop.')],
    ['has no content (all reasoning)', gatewaySays(null)],
    ['is a 402 (out of credit)', () => new Response('{}', { status: 402 })],
    ['is a 401 (the key expired)', () => new Response('{}', { status: 401 })],
    ['times out', () => { throw new DOMException('The operation timed out', 'TimeoutError') }],
  ])('falls back to the written ladder when the gateway %s', async (_why, gateway) => {
    world.gateway = gateway
    const res = await run(undefined, TOKEN, GW)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hint: 'Think about repeating', source: 'ladder', remaining: 2 })
    expect(inserts('hint_cache')).toHaveLength(0)
  })

  it('needs both the URL and the key; otherwise Gemini (or the ladder) as before', async () => {
    await run(undefined, TOKEN, { ...ENV, AI_GATEWAY_URL: 'https://ai.gateway.test/v1' })
    expect(gatewayCalls()).toHaveLength(0)
    expect(geminiCalls()).toHaveLength(1)
  })
})
