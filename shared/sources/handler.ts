import { z } from 'zod'
import {
  PROGRAMMING_LANGUAGES, ReadmeRequest, SearchRequest, SourceError, SOURCES,
  type ParsedSearch, type Problem, type SourceId, type SourceResult,
} from './catalog'
import { fetchReadme, searchGitHub } from './github'
import { searchYouTube } from './youtube'

// POST /api/sources/search and POST /api/sources/readme. Lives here, not in functions/, so it can be
// tested without Cloudflare.
//
// Only authors (CIC admins, and instructors with authoring rights) may call them: the caller's own
// token is checked by Supabase Auth, then the database's is_author() is asked WITH THAT TOKEN. No
// service role is used at all. Nothing about students is involved: the only thing sent to YouTube
// or GitHub is the topic the author typed.

export interface SourcesEnv {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  /** YouTube Data API v3 key. Without it, the video sources say "not set up" and GitHub still works. */
  YOUTUBE_API_KEY?: string
  /** Optional GitHub token (no scopes needed): 30 searches a minute instead of 10. */
  GITHUB_TOKEN?: string
}

/** Results are the same for everyone, so they are cached by query (not by person) for a day. */
export interface SourcesCache {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
}
export interface SourcesDeps {
  fetch?: typeof fetch
  cache?: SourcesCache
}

const MAX_BODY = 2048

function replier(request: Request, event: string) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  return (status: number, body: unknown) => {
    // Only the request id and the status are logged: never the token or the key.
    console.log(JSON.stringify({ event, requestId, status }))
    return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'x-request-id': requestId } })
  }
}

async function readBody<T>(request: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T | null> {
  const text = await request.text()
  if (text.length > MAX_BODY) return null
  try {
    const parsed = schema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** 'ok', or the status to answer with: 401 (no or bad token), 403 (not an author), 503 (not set up or down). */
async function authorize(request: Request, env: SourcesEnv, f: typeof fetch): Promise<'ok' | 401 | 403 | 503> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return 503
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token) return 401
  const auth = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  try {
    const who = await f(`${base}/auth/v1/user`, { headers: auth })
    if (!who.ok) return 401
    const author = await f(`${base}/rest/v1/rpc/is_author`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' })
    if (!author.ok) return author.status === 401 ? 401 : 503
    return (await author.json()) === true ? 'ok' : 403
  } catch {
    return 503
  }
}

const AUTH_ERRORS = { 401: 'unauthorized', 403: 'forbidden', 503: 'unavailable' } as const

async function cached<T>(cache: SourcesCache | undefined, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cache?.get(key).catch(() => undefined)
  if (hit !== undefined && hit !== null) return hit as T
  const value = await load()
  await cache?.put(key, value).catch(() => undefined) // a miss next time is fine
  return value
}

/** One source, from the cache or the network. Throws SourceError. */
function searchOne(source: SourceId, q: ParsedSearch, env: SourcesEnv, f: typeof fetch, cache?: SourcesCache): Promise<SourceResult[]> {
  const lang = PROGRAMMING_LANGUAGES[q.programmingLanguage]
  const topic = q.topic.toLowerCase().replace(/\s+/g, ' ')
  const key = ['v1', source, topic, q.spokenLanguage, q.programmingLanguage, q.creativeCommonsOnly ? 'cc' : 'any'].join('|')
  if (source === 'github') {
    // A language GitHub knows becomes a `language:` filter; one it does not (Scratch) becomes a search word.
    const query = [topic, lang.github ? '' : lang.words].filter(Boolean).join(' ')
    return cached(cache, key, () => searchGitHub(f, env.GITHUB_TOKEN, { query, language: lang.github }))
  }
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) return Promise.reject(new SourceError('not_configured'))
  return cached(cache, key, () => searchYouTube(f, apiKey, {
    source,
    query: [topic, lang.words].filter(Boolean).join(' '),
    language: q.spokenLanguage,
    channelId: SOURCES[source].channelId,
    creativeCommonsOnly: q.creativeCommonsOnly,
  }))
}

export async function handleSourceSearch(request: Request, env: SourcesEnv, deps: SourcesDeps = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const reply = replier(request, 'sources.search')
  const q = await readBody(request, SearchRequest)
  if (!q) return reply(400, { error: 'invalid_request' })
  const allowed = await authorize(request, env, f)
  if (allowed !== 'ok') return reply(allowed, { error: AUTH_ERRORS[allowed] })

  const settled = await Promise.allSettled(q.sources.map((s) => searchOne(s, q, env, f, deps.cache)))
  const results: SourceResult[] = []
  const problems: { source: SourceId; error: Problem }[] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(...r.value)
    else {
      const code = r.reason instanceof SourceError ? r.reason.code : 'unavailable'
      problems.push({ source: q.sources[i]!, error: code === 'not_configured' || code === 'quota' ? code : 'unavailable' })
    }
  })
  return reply(200, { results, problems })
}

export async function handleReadme(request: Request, env: SourcesEnv, deps: SourcesDeps = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const reply = replier(request, 'sources.readme')
  const body = await readBody(request, ReadmeRequest)
  if (!body) return reply(400, { error: 'invalid_request' })
  const allowed = await authorize(request, env, f)
  if (allowed !== 'ok') return reply(allowed, { error: AUTH_ERRORS[allowed] })

  try {
    const readme = await cached(deps.cache, `v1|readme|${body.repo.toLowerCase()}`, () => fetchReadme(f, env.GITHUB_TOKEN, body.repo))
    return reply(200, readme)
  } catch (e) {
    const code = e instanceof SourceError ? e.code : 'unavailable'
    if (code === 'not_open_license') return reply(422, { error: code })
    if (code === 'no_readme' || code === 'not_found') return reply(404, { error: 'no_readme' })
    if (code === 'quota') return reply(429, { error: 'quota' })
    return reply(503, { error: 'unavailable' })
  }
}
