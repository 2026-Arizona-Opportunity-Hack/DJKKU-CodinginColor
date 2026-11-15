import { SourceError, type SourceId, type SourceResult } from './catalog'

// YouTube Data API v3. One search (the "Search Queries" bucket: 100 a day per project) plus one
// videos call for length, license and whether it can be embedded. Results are strict SafeSearch and
// embeddable only, because students watch them inside the lesson.

const API = 'https://www.googleapis.com/youtube/v3'
export const TIMEOUT_MS = 6000

export interface VideoSearch {
  source: SourceId
  query: string
  language: string
  channelId: string | null
  creativeCommonsOnly: boolean
  max?: number
}

type SearchItem = { id?: { videoId?: string }; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> } }
type VideoItem = { id?: string; contentDetails?: { duration?: string }; status?: { license?: string; embeddable?: boolean } }

/** YouTube sends titles HTML-escaped (`Don&#39;t`); undo the few escapes it uses. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** `PT1H2M3S` → 3723. Anything else (a live stream is `P0D`, a missing value) → null. */
export function isoDuration(s: string | undefined): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s ?? '')
  if (!m) return null
  const [, d = '0', h = '0', min = '0', sec = '0'] = m
  const total = Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(sec)
  return total > 0 ? total : null
}

async function call(f: typeof fetch, path: string, params: Record<string, string>): Promise<unknown> {
  let res: Response
  try {
    res = await f(`${API}/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new SourceError('unavailable')
  }
  if (res.ok) return res.json()
  // A spent quota is a 403 (or 429) whose reason says so. Say that plainly; everything else is "unavailable".
  const body = (await res.json().catch(() => ({}))) as { error?: { errors?: { reason?: string }[] } }
  const reasons = (body.error?.errors ?? []).map((e) => e.reason ?? '')
  if (res.status === 429 || reasons.some((r) => /quota|rateLimit/i.test(r))) throw new SourceError('quota')
  throw new SourceError('unavailable')
}

export async function searchYouTube(f: typeof fetch, apiKey: string, q: VideoSearch): Promise<SourceResult[]> {
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    q: q.query,
    maxResults: String(q.max ?? 8),
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    relevanceLanguage: q.language,
    key: apiKey,
  }
  if (q.channelId) params.channelId = q.channelId
  if (q.creativeCommonsOnly) params.videoLicense = 'creativeCommon'

  const found = ((await call(f, 'search', params)) as { items?: SearchItem[] }).items ?? []
  const items = found.filter((i): i is SearchItem & { id: { videoId: string } } => typeof i.id?.videoId === 'string')
  if (items.length === 0) return []

  // Length, license and "can it be embedded" are not in search results. One call for all of them.
  const details = ((await call(f, 'videos', { part: 'contentDetails,status', id: items.map((i) => i.id.videoId).join(','), key: apiKey })) as { items?: VideoItem[] }).items ?? []
  const byId = new Map(details.map((d) => [d.id, d]))

  return items.flatMap((i): SourceResult[] => {
    const d = byId.get(i.id.videoId)
    if (d?.status?.embeddable === false) return []
    const s = i.snippet ?? {}
    const cc = d?.status?.license === 'creativeCommon'
    return [{
      source: q.source,
      kind: 'video',
      id: i.id.videoId,
      title: decodeEntities(s.title ?? 'Untitled video'),
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      by: decodeEntities(s.channelTitle ?? ''),
      description: decodeEntities(s.description ?? ''),
      license: cc ? { id: 'CC-BY', name: 'Creative Commons (CC BY)', open: true } : { id: 'youtube', name: 'Standard YouTube license (embed only)', open: false },
      durationS: isoDuration(d?.contentDetails?.duration),
      stars: null,
      thumbnail: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? null,
      publishedAt: s.publishedAt ?? null,
    }]
  })
}
