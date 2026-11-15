import { z } from 'zod'

import { log } from '@/lib/log'

// Client side of /api/transcript (see shared/transcript/handler.ts). Kept apart from the component
// so React fast refresh keeps working.

const Body = z.object({
  video_id: z.string(),
  lang: z.string().nullable(),
  segments: z.array(z.object({ start_ms: z.number(), text: z.string() })).min(1),
})
export type Transcript = z.infer<typeof Body>

const apiBase = () => String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export async function fetchTranscript(videoId: string, f: typeof fetch = fetch): Promise<Transcript> {
  const requestId = crypto.randomUUID()
  const res = await f(`${apiBase()}/api/transcript?videoId=${encodeURIComponent(videoId)}`, { headers: { 'x-request-id': requestId } })
  const json: unknown = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null
  if (!res.ok || !json) {
    const code = json && typeof json === 'object' && 'error' in json ? String(json.error) : `http_${res.status}`
    // Expected for videos without captions; logged once at info so it is visible when debugging.
    log.info('video.transcript_unavailable', { requestId, videoId, code })
    throw new Error(code)
  }
  return Body.parse(json)
}

/** 83000 -> "1:23", 3723000 -> "1:02:03". */
export function timestamp(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export type Line = { index: number; start_ms: number; text: string }
export type Paragraph = { start_ms: number; lines: Line[] }

/**
 * Caption lines grouped into readable paragraphs (about `maxChars` or `maxMs` of video each, broken
 * only between lines), so the transcript reads like text while each line can still be highlighted as
 * it is spoken, and each paragraph's timestamp stays close to every line in it.
 */
export function groupParagraphs(segments: { start_ms: number; text: string }[], maxChars = 320, maxMs = 30_000): Paragraph[] {
  const out: Paragraph[] = []
  let current: Paragraph | null = null
  let chars = 0
  segments.forEach((s, index) => {
    if (!current || chars + s.text.length > maxChars || s.start_ms - current.start_ms >= maxMs) {
      current = { start_ms: s.start_ms, lines: [] }
      out.push(current)
      chars = 0
    }
    current.lines.push({ index, start_ms: s.start_ms, text: s.text })
    chars += s.text.length + 1
  })
  return out
}

/** Index of the line being spoken at `timeMs` (the last one that has started), or -1 before the first. */
export function activeIndex(segments: { start_ms: number }[], timeMs: number): number {
  let lo = 0
  let hi = segments.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid]!.start_ms <= timeMs) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}
