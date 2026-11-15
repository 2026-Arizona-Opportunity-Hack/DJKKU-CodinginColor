import { z } from 'zod'

import { youtubeEmbedUrl } from '../authoring/schemas'

// GET /api/transcript?videoId=<11-char YouTube id>. Lives here, not in functions/, so it can be
// tested without Cloudflare.
//
// The real transcript of a lesson video, from the video's own YouTube captions via Supadata
// (https://docs.supadata.ai). Three rules keep it free and safe:
//   1. Only videos used in a PUBLISHED activity are fetched, so nobody can spend our 100 free
//      requests a month on arbitrary videos.
//   2. Every answer (transcript or "no captions") is cached in video_transcripts: a video costs at
//      most one request, ever. "No captions" is retried after a week.
//   3. mode=native: only existing captions. No AI transcription (slower, async, costs more credits).
// The Supadata key stays on the server and is never logged or returned.

export const SUPADATA_URL = 'https://api.supadata.ai/v1/transcript'
const TIMEOUT_MS = 10_000
const RETRY_UNAVAILABLE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_TOTAL_CHARS = 200_000 // about 4 hours of speech; longer is cut, never an error
const CHUNK_CHARS = 400 // Supadata merges captions into readable paragraphs of about this size
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
// CIC teaches in English. Without `lang`, Supadata returns the FIRST caption track it finds, which can
// be a partial translation (found locally: an English lesson came back in Arabic). Ask for English and
// treat any other language as "no transcript", so students get the author's summary instead.
export const TRANSCRIPT_LANG = 'en'

export interface TranscriptEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  /** Supadata API key (free plan). Optional: without it the player shows the author's summary. */
  SUPADATA_API_KEY?: string
}
export interface TranscriptDeps {
  fetch?: typeof fetch
  now?: () => number
}

export type Segment = { start_ms: number; text: string }
export type TranscriptBody = { video_id: string; lang: string | null; segments: Segment[]; source: 'cache' | 'supadata' }

const SupadataChunks = z.object({
  lang: z.string().max(12).nullish(),
  content: z.array(z.object({ text: z.string(), offset: z.number().nonnegative() })),
})
const CacheRow = z.object({
  status: z.enum(['ok', 'unavailable']),
  lang: z.string().nullable(),
  segments: z.array(z.object({ start_ms: z.number(), text: z.string() })),
  fetched_at: z.string(),
})

/** Caption text can carry HTML entities and line breaks; students should see plain sentences. */
function clean(text: string): string {
  return text
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toSegments(chunks: { text: string; offset: number }[]): Segment[] {
  const out: Segment[] = []
  let total = 0
  for (const c of chunks) {
    const text = clean(c.text)
    if (!text) continue
    if (total + text.length > MAX_TOTAL_CHARS) break
    total += text.length
    out.push({ start_ms: Math.round(c.offset), text })
  }
  return out
}

export async function handleTranscript(request: Request, env: TranscriptEnv, deps: TranscriptDeps = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const now = deps.now ?? Date.now
  const started = now()
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const log = (status: number, extra: Record<string, unknown>) =>
    // Never the API key, never the transcript text: the video id is public.
    console.log(JSON.stringify({ event: 'transcript', requestId, status, duration_ms: now() - started, ...extra }))
  const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => {
    log(status, { error, ...extra })
    return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId } })
  }
  const ok = (body: TranscriptBody) => {
    log(200, { videoId: body.video_id, source: body.source, segments: body.segments.length })
    // Public captions, identical for everyone: browsers and the edge may keep them for a day.
    return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=86400', 'x-request-id': requestId } })
  }

  // 1. Input.
  const videoId = new URL(request.url).searchParams.get('videoId') ?? ''
  if (!VIDEO_ID.test(videoId)) return fail(400, 'invalid_request')
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return fail(503, 'unavailable', { cause: 'missing_supabase_env' })
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const service = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
  const read = async (path: string) => {
    const r = await f(`${base}/rest/v1/${path}`, { headers: service })
    if (!r.ok) throw new Error(`supabase read ${r.status}`)
    return (await r.json()) as unknown[]
  }
  const remember = (row: { status: 'ok' | 'unavailable'; lang: string | null; segments: Segment[] }) =>
    f(`${base}/rest/v1/video_transcripts?on_conflict=video_id`, {
      method: 'POST',
      headers: { ...service, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ video_id: videoId, ...row, fetched_at: new Date(now()).toISOString() }),
    }).then((r) => {
      if (!r.ok) console.log(JSON.stringify({ event: 'transcript.cache_write_failed', requestId, status: r.status }))
    }, () => undefined) // a cache miss next time costs one request; never fail the student for it

  try {
    // 2. Is this video in a published lesson? (Guards the free quota against arbitrary ids.)
    const embed = encodeURIComponent(youtubeEmbedUrl(videoId))
    const used = await read(
      `activities?select=id,lessons!inner(modules!inner(status))&kind=eq.video&content->>embedUrl=eq.${embed}&lessons.modules.status=eq.published&limit=1`,
    )
    if (used.length === 0) return fail(404, 'not_found', { videoId })

    // 3. Cache.
    const cached = CacheRow.safeParse((await read(`video_transcripts?video_id=eq.${videoId}&select=status,lang,segments,fetched_at&limit=1`))[0])
    if (cached.success) {
      // A cached transcript in another language (stored before lang=en was sent) is treated as a miss and replaced.
      const english = !cached.data.lang || cached.data.lang.toLowerCase().startsWith(TRANSCRIPT_LANG)
      if (cached.data.status === 'ok' && english) return ok({ video_id: videoId, lang: cached.data.lang, segments: cached.data.segments, source: 'cache' })
      if (cached.data.status === 'unavailable' && now() - Date.parse(cached.data.fetched_at) < RETRY_UNAVAILABLE_MS) {
        return fail(404, 'transcript_unavailable', { videoId, source: 'cache' })
      }
    }

    // 4. Supadata.
    if (!env.SUPADATA_API_KEY) return fail(503, 'unavailable', { videoId, cause: 'missing_supadata_key' })
    const params = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, lang: TRANSCRIPT_LANG, mode: 'native', chunkSize: String(CHUNK_CHARS) })
    let res: Response
    try {
      res = await f(`${SUPADATA_URL}?${params}`, { headers: { 'x-api-key': env.SUPADATA_API_KEY }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (e) {
      return fail(503, 'unavailable', { videoId, cause: (e as Error).name === 'TimeoutError' ? 'upstream_timeout' : 'upstream_network' })
    }

    // No captions (206), unknown video (404), or an async AI job we did not ask for (202): remember it.
    if (res.status === 206 || res.status === 404 || res.status === 202) {
      await remember({ status: 'unavailable', lang: null, segments: [] })
      return fail(404, 'transcript_unavailable', { videoId, upstream_status: res.status })
    }
    // Quota (402/429), bad key (401/403), outage (5xx): not the video's fault, so nothing is cached.
    if (!res.ok) return fail(503, 'unavailable', { videoId, upstream_status: res.status })

    const parsed = SupadataChunks.safeParse(await res.json().catch(() => null))
    if (!parsed.success) return fail(503, 'unavailable', { videoId, cause: 'upstream_shape' })
    if (parsed.data.lang && !parsed.data.lang.toLowerCase().startsWith(TRANSCRIPT_LANG)) {
      await remember({ status: 'unavailable', lang: parsed.data.lang, segments: [] })
      return fail(404, 'transcript_unavailable', { videoId, cause: 'wrong_language', lang: parsed.data.lang })
    }
    const segments = toSegments(parsed.data.content)
    if (segments.length === 0) {
      await remember({ status: 'unavailable', lang: null, segments: [] })
      return fail(404, 'transcript_unavailable', { videoId, cause: 'empty' })
    }
    const lang = parsed.data.lang ?? null
    await remember({ status: 'ok', lang, segments })
    return ok({ video_id: videoId, lang, segments, source: 'supadata' })
  } catch (e) {
    return fail(503, 'unavailable', { videoId, cause: (e as Error).message })
  }
}
