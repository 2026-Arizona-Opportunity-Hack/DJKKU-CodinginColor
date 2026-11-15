import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { handleTranscript, SUPADATA_URL, toSegments, type TranscriptEnv } from './handler'

const BASE = 'https://proj.supabase.co'
const ENV: TranscriptEnv = { SUPABASE_URL: BASE, SUPABASE_SERVICE_ROLE_KEY: 'service-role-key', SUPADATA_API_KEY: 'supadata-secret-key' }
const VIDEO = 'Z1Yd7upQsXY'
const NOW = Date.parse('2026-11-15T12:00:00Z')

interface World { published: boolean; cache: unknown[]; supadata: () => Response | Promise<Response> }
let world: World
let calls: { url: string; init?: RequestInit }[]
let logs: string[]

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  calls.push({ url, init })
  if (url.startsWith(`${BASE}/rest/v1/activities?`)) return Response.json(world.published ? [{ id: 'a1' }] : [])
  if (url.startsWith(`${BASE}/rest/v1/video_transcripts?video_id=eq.`)) return Response.json(world.cache)
  if (url.startsWith(`${BASE}/rest/v1/video_transcripts?on_conflict`)) return new Response(null, { status: 201 })
  if (url.startsWith(SUPADATA_URL)) return world.supadata()
  return new Response('{}', { status: 404 })
}) as typeof fetch

const get = (videoId = VIDEO, env = ENV) =>
  handleTranscript(new Request(`https://site.test/api/transcript?videoId=${videoId}`), env, { fetch: fakeFetch, now: () => NOW })
const supadataCalls = () => calls.filter((c) => c.url.startsWith(SUPADATA_URL))
const writes = () => calls.filter((c) => c.url.includes('on_conflict')).map((c) => JSON.parse(String(c.init?.body)))

beforeEach(() => {
  calls = []
  logs = []
  world = {
    published: true,
    cache: [],
    supadata: () => Response.json({ lang: 'en', availableLangs: ['en'], content: [
      { text: 'A variable is a name &amp; a value.', offset: 1200, duration: 3000, lang: 'en' },
      { text: "  It&#39;s like a\nlabelled box. ", offset: 65_000, duration: 2000, lang: 'en' },
    ] }),
  }
  vi.spyOn(console, 'log').mockImplementation((line: string) => void logs.push(line))
})
afterEach(() => vi.restoreAllMocks())

describe('GET /api/transcript', () => {
  it('fetches the real captions once, cleans them, caches them and returns timed paragraphs', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ video_id: VIDEO, lang: 'en', source: 'supadata', segments: [
      { start_ms: 1200, text: 'A variable is a name & a value.' },
      { start_ms: 65_000, text: "It's like a labelled box." },
    ] })
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    const [call] = supadataCalls()
    expect(call!.url).toContain('mode=native') // captions only: no paid AI transcription
    expect(call!.url).toContain('lang=en') // otherwise Supadata returns the first track, e.g. a partial translation
    expect(call!.url).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${VIDEO}`))
    const headers = (call!.init!.headers ?? {}) as Record<string, string>
    expect(headers['x-api-key']).toBe('supadata-secret-key')
    expect(writes()).toEqual([expect.objectContaining({ video_id: VIDEO, status: 'ok', lang: 'en' })])
  })

  it('refuses a transcript in another language and remembers it (an English lesson came back in Arabic)', async () => {
    world.supadata = () => Response.json({ lang: 'ar', availableLangs: ['ar'], content: [{ text: 'أهلاً بكم', offset: 0, duration: 1000 }] })
    const res = await get()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'transcript_unavailable' })
    expect(writes()).toEqual([expect.objectContaining({ status: 'unavailable', lang: 'ar', segments: [] })])
    expect(logs.some((l) => l.includes('"cause":"wrong_language"'))).toBe(true)
  })

  it('replaces a non-English transcript cached before the language fix', async () => {
    world.cache = [{ status: 'ok', lang: 'ar', segments: [{ start_ms: 0, text: 'أهلاً بكم' }], fetched_at: '2026-11-15T10:00:00Z' }]
    const res = await get()
    expect(await res.json()).toMatchObject({ source: 'supadata', lang: 'en' })
    expect(supadataCalls()).toHaveLength(1)
    expect(writes()).toEqual([expect.objectContaining({ status: 'ok', lang: 'en' })])
  })

  it('accepts regional English such as en-US', async () => {
    world.supadata = () => Response.json({ lang: 'en-US', availableLangs: ['en-US'], content: [{ text: 'Hello.', offset: 0, duration: 1000 }] })
    expect((await get()).status).toBe(200)
  })

  it('serves the cache without spending a Supadata request', async () => {
    world.cache = [{ status: 'ok', lang: 'en', segments: [{ start_ms: 0, text: 'Cached.' }], fetched_at: '2026-11-01T00:00:00Z' }]
    const res = await get()
    expect(await res.json()).toMatchObject({ source: 'cache', segments: [{ start_ms: 0, text: 'Cached.' }] })
    expect(supadataCalls()).toHaveLength(0)
  })

  it('only fetches videos that are in a published lesson (protects the free quota)', async () => {
    world.published = false
    const res = await get()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(supadataCalls()).toHaveLength(0)
  })

  it.each(['abc', 'Z1Yd7upQsXY&x=1', '../../etc/pass', ''])('refuses a malformed video id %j before touching anything', async (id) => {
    const res = await get(encodeURIComponent(id))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('remembers "no captions" (206) and does not ask again within a week', async () => {
    world.supadata = () => Response.json({ error: 'transcript-unavailable', message: 'none', details: '' }, { status: 206 })
    const first = await get()
    expect(first.status).toBe(404)
    expect(await first.json()).toEqual({ error: 'transcript_unavailable' })
    expect(writes()).toEqual([expect.objectContaining({ status: 'unavailable', segments: [] })])

    world.cache = [{ status: 'unavailable', lang: null, segments: [], fetched_at: '2026-11-14T00:00:00Z' }]
    calls = []
    expect((await get()).status).toBe(404)
    expect(supadataCalls()).toHaveLength(0)
  })

  it('asks again once "no captions" is more than a week old', async () => {
    world.cache = [{ status: 'unavailable', lang: null, segments: [], fetched_at: '2026-11-01T00:00:00Z' }]
    expect((await get()).status).toBe(200)
    expect(supadataCalls()).toHaveLength(1)
  })

  it.each([429, 402, 401, 500])('upstream %i is a temporary 503 and is never cached as "no captions"', async (status) => {
    world.supadata = () => Response.json({ error: 'x', message: 'x', details: '' }, { status })
    const res = await get()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'unavailable' })
    expect(writes()).toHaveLength(0)
  })

  it('a timeout is a 503 with the cause logged', async () => {
    world.supadata = () => Promise.reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
    expect((await get()).status).toBe(503)
    expect(logs.some((l) => l.includes('"cause":"upstream_timeout"'))).toBe(true)
  })

  it('without a Supadata key it says unavailable (the player then shows the author summary)', async () => {
    const res = await get(VIDEO, { ...ENV, SUPADATA_API_KEY: undefined })
    expect(res.status).toBe(503)
    expect(logs.some((l) => l.includes('missing_supadata_key'))).toBe(true)
  })

  it('logs one line per request with the request id, and never the keys or the transcript', async () => {
    await handleTranscript(new Request(`https://site.test/api/transcript?videoId=${VIDEO}`, { headers: { 'x-request-id': 'req-123' } }), ENV, { fetch: fakeFetch, now: () => NOW })
    const lines = logs.filter((l) => l.includes('"event":"transcript"'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"requestId":"req-123"')
    const all = logs.join('\n')
    expect(all).not.toContain('supadata-secret-key')
    expect(all).not.toContain('service-role-key')
    expect(all).not.toContain('labelled box')
  })
})

describe('toSegments', () => {
  it('drops empty captions and stops at the size cap instead of failing', () => {
    const many = Array.from({ length: 3000 }, (_, i) => ({ text: 'x'.repeat(100), offset: i * 1000 }))
    const out = toSegments([{ text: '   ', offset: 0 }, ...many])
    expect(out[0]!.start_ms).toBe(0)
    expect(out.reduce((n, s) => n + s.text.length, 0)).toBeLessThanOrEqual(200_000)
  })
})
