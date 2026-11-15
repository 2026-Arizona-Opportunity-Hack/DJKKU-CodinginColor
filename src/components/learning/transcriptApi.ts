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
