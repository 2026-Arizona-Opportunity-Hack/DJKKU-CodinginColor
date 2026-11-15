import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleReadme, handleSourceSearch, type SourcesCache, type SourcesEnv } from './handler'

const BASE = 'https://proj.supabase.co'
const ENV: SourcesEnv = { SUPABASE_URL: BASE, SUPABASE_ANON_KEY: 'anon-key', YOUTUBE_API_KEY: 'yt-key' }
const TOKEN = 'author-access-token'

interface World { authOk: boolean; author: boolean; youtube: () => Response; github: () => Response }
let world: World
let calls: { url: string; init?: RequestInit }[]

const ghRepo = { full_name: 'cic/loops', name: 'loops', html_url: 'https://github.com/cic/loops', description: 'd', stargazers_count: 5, default_branch: 'main', owner: { login: 'cic' }, license: { spdx_id: 'MIT' } }
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  calls.push({ url, init })
  if (url === `${BASE}/auth/v1/user`) return world.authOk ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 })
  if (url === `${BASE}/rest/v1/rpc/is_author`) return Response.json(world.author)
  if (url.startsWith('https://www.googleapis.com/youtube/v3/search')) return world.youtube()
  if (url.startsWith('https://www.googleapis.com/youtube/v3/videos')) return Response.json({ items: [{ id: 'aaaaaaaaaaa', status: { license: 'youtube', embeddable: true } }] })
  if (url.startsWith('https://api.github.com/search/')) return world.github()
  if (url === 'https://api.github.com/repos/cic/loops') return Response.json(ghRepo)
  if (url === 'https://api.github.com/repos/cic/loops/readme') return new Response('# Loops')
  return new Response('{}', { status: 404 })
}) as typeof fetch

const req = (path: string, body: unknown, token: string | null = TOKEN) =>
  new Request(`https://site.test/api/sources/${path}`, { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const SEARCH = { topic: 'For  Loops', sources: ['youtube', 'github'] }
const search = (body: unknown = SEARCH, token: string | null = TOKEN, env = ENV, cache?: SourcesCache) => handleSourceSearch(req('search', body, token), env, { fetch: fakeFetch, cache })
const readme = (body: unknown = { repo: 'cic/loops' }, token: string | null = TOKEN, env = ENV) => handleReadme(req('readme', body, token), env, { fetch: fakeFetch })
const upstream = () => calls.filter((c) => !c.url.startsWith(BASE))

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  world = {
    authOk: true, author: true,
    youtube: () => Response.json({ items: [{ id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'Loops', channelTitle: 'C' } }] }),
    github: () => Response.json({ items: [ghRepo] }),
  }
  calls = []
})

describe('who may search', () => {
  it('answers 400 for a body that is not valid, before asking anyone', async () => {
    for (const bad of ['nope', {}, { topic: 'x', sources: ['youtube'] }, { topic: 'loops', sources: [] }, { topic: 'loops', sources: ['bing'] },
      { topic: 'loops', sources: ['github', 'github'] }, { ...SEARCH, extra: 1 }, { ...SEARCH, topic: 'x'.repeat(101) }, { ...SEARCH, spokenLanguage: 'klingon' }, 'x'.repeat(3000)]) {
      expect((await search(bad)).status).toBe(400)
    }
    expect(calls).toEqual([])
  })

  it('answers 401 without a token or with a bad one', async () => {
    expect((await search(SEARCH, null)).status).toBe(401)
    world.authOk = false
    expect((await search()).status).toBe(401)
    expect(upstream()).toEqual([])
  })

  it('answers 403 to someone who is not an author, asking the database with their own token', async () => {
    world.author = false
    const res = await search()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    const ask = calls.find((c) => c.url.endsWith('/rpc/is_author'))!
    expect((ask.init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(upstream()).toEqual([])
  })

  it('answers 503 when Supabase is not configured', async () => {
    expect((await search(SEARCH, TOKEN, { YOUTUBE_API_KEY: 'k' })).status).toBe(503)
  })
})

describe('searching', () => {
  it('returns results from every source asked, never cached in the browser', async () => {
    const res = await search()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const body = await res.json() as { results: { source: string; id: string }[]; problems: unknown[] }
    expect(body.results.map((r) => [r.source, r.id])).toEqual([['youtube', 'aaaaaaaaaaa'], ['github', 'cic/loops']])
    expect(body.problems).toEqual([])
    const yt = new URL(upstream().find((c) => c.url.includes('/youtube/v3/search'))!.url)
    expect(yt.searchParams.get('q')).toBe('for loops') // trimmed, lower case, single spaces
  })

  it('adds the programming language to the video search and as a GitHub filter', async () => {
    await search({ ...SEARCH, programmingLanguage: 'python', spokenLanguage: 'es' })
    const yt = new URL(upstream().find((c) => c.url.includes('/youtube/v3/search'))!.url)
    expect(yt.searchParams.get('q')).toBe('for loops python')
    expect(yt.searchParams.get('relevanceLanguage')).toBe('es')
    const gh = new URL(upstream().find((c) => c.url.includes('/search/repositories'))!.url)
    expect(gh.searchParams.get('q')).toBe('for loops beginners language:python archived:false fork:false is:public')
  })

  it('uses a channel for the freeCodeCamp and CS50 presets', async () => {
    await search({ topic: 'loops', sources: ['freecodecamp', 'cs50'] })
    const channels = upstream().filter((c) => c.url.includes('/youtube/v3/search')).map((c) => new URL(c.url).searchParams.get('channelId'))
    expect(channels).toEqual(['UC8butISFwT-Wl7EV0hUK0BQ', 'UCcabW7890RKJzL968QWEykA'])
  })

  it('still answers with GitHub when YouTube is not set up or out of quota', async () => {
    const noKey = await (await search(SEARCH, TOKEN, { ...ENV, YOUTUBE_API_KEY: undefined })).json() as { results: unknown[]; problems: unknown[] }
    expect(noKey.problems).toEqual([{ source: 'youtube', error: 'not_configured' }])
    expect(noKey.results).toHaveLength(1)
    world.youtube = () => new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })
    const spent = await (await search()).json() as { problems: unknown[] }
    expect(spent.problems).toEqual([{ source: 'youtube', error: 'quota' }])
  })

  it('serves a repeated search from the cache, whoever asks', async () => {
    const store = new Map<string, unknown>()
    const cache: SourcesCache = { get: async (k) => store.get(k), put: async (k, v) => void store.set(k, v) }
    await search(SEARCH, TOKEN, ENV, cache)
    const first = upstream().length
    await search({ ...SEARCH, topic: 'for loops' }, 'another-author', ENV, cache)
    expect(upstream().length).toBe(first)
    expect([...store.keys()].sort()).toEqual(['v1|github|for loops|en|any|any', 'v1|youtube|for loops|en|any|any'])
  })

  it('a broken cache is only a miss', async () => {
    const cache: SourcesCache = { get: () => Promise.reject(new Error('x')), put: () => Promise.reject(new Error('y')) }
    expect((await search(SEARCH, TOKEN, ENV, cache)).status).toBe(200)
  })
})

describe('importing a README', () => {
  it('returns the reading for an author', async () => {
    const res = await readme()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'loops (GitHub)', url: 'https://github.com/cic/loops', license: { id: 'MIT', open: true } })
  })

  it('checks the body and the caller first', async () => {
    for (const bad of [{}, { repo: '../../etc' }, { repo: 'a/b/c' }, { repo: 'cic/loops', x: 1 }]) expect((await readme(bad)).status).toBe(400)
    expect((await readme(undefined, null)).status).toBe(401)
    world.author = false
    expect((await readme()).status).toBe(403)
    expect(upstream()).toEqual([])
  })

  it('refuses a repository that is not openly licensed', async () => {
    const original = ghRepo.license
    ghRepo.license = null as unknown as { spdx_id: string }
    try {
      const res = await readme()
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ error: 'not_open_license' })
    } finally {
      ghRepo.license = original
    }
  })

  it('says 404 when the repository or its README is missing', async () => {
    expect((await readme({ repo: 'cic/missing' })).status).toBe(404)
  })
})
