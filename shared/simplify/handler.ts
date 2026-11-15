import { z } from 'zod'
import { aiConfigured, completeJson, type AiEnv } from '../ai/complete'
import type { SourcesCache } from '../sources/handler'
import { handleTranscript, type TranscriptEnv } from '../transcript/handler'
import { GRADES, rubricPrompt, RUBRIC, type Grade } from './rubric'

// POST /api/simplify: "Explain it for my grade". Rewrites one reading or video for a grade (1 to 12)
// using the rubric in ./rubric.ts. Lives here, not in functions/, so it can be tested without Cloudflare.
//
// The browser sends only an activity id and a grade, never text: the server loads the activity with the
// caller's own token through get_activity (locks and class access apply; guests reach open lessons only),
// so the AI can only ever be asked about real lesson material. The grade is not stored anywhere. Results are
// cached per activity, grade and material, so the same request never reaches the AI twice.
// Which AI provider answers is set by the deployment (shared/ai/complete.ts).

export const SimplifyRequest = z.object({ activity_id: z.string().uuid(), grade: z.number().int().min(1).max(12) }).strict()

const text = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max))
export const Simplified = z.object({
  summary: text(400),
  explanation: text(4000),
  example: text(1200),
  keyTerms: z.array(z.object({ term: text(60), meaning: text(240) })).max(6).default([]),
  checkQuestion: z.object({ question: text(400), answer: text(600) }),
})
export type Simplified = z.infer<typeof Simplified>
export type SimplifyResponse = Simplified & { grade: Grade; source: 'ai' | 'cache' }

const MAX_BODY_CHARS = 1_000
const MAX_MATERIAL_CHARS = 8_000
const CACHE_VERSION = 'simplify-v1'

export const SYSTEM_PROMPT = [
  'You rewrite lesson material for a free coding course so a student of a given grade understands it.',
  'Keep every fact correct and keep the main ideas of the original; do not add new topics or opinions.',
  'Follow the grade rubric exactly for vocabulary, sentence length, examples and technical terms.',
  'Be warm and encouraging. Use markdown for the explanation (short paragraphs, lists, `code`). No HTML, no links, no images.',
  'Reply with JSON only, in this shape:',
  '{"summary":"1-2 sentences","explanation":"markdown","example":"one example in the rubric style","keyTerms":[{"term":"...","meaning":"..."}],"checkQuestion":{"question":"...","answer":"..."}}',
  'keyTerms: 0 to 6 terms a student at this grade needs, with meanings at their level (none for grades 1-2).',
].join(' ')

export function buildPrompt(grade: Grade, title: string, material: string): string {
  return [rubricPrompt(grade, title), '', `LESSON TITLE: ${title}`, 'LESSON MATERIAL:', material].join('\n')
}

const videoIdOf = (embedUrl: unknown) => (typeof embedUrl === 'string' ? /\/embed\/([A-Za-z0-9_-]{11})/.exec(embedUrl)?.[1] ?? null : null)

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')

export type SimplifyEnv = AiEnv & TranscriptEnv & { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }
export interface SimplifyDeps { fetch?: typeof fetch; cache?: SourcesCache }

export async function handleSimplify(request: Request, env: SimplifyEnv, deps: SimplifyDeps = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const reply = (status: number, body: unknown) => {
    console.log(JSON.stringify({ event: 'simplify', status, source: (body as { source?: string }).source })) // never text or token
    return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_CHARS) return reply(413, { error: 'too_large' })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return reply(400, { error: 'invalid_request' }) }
  const parsed = SimplifyRequest.safeParse(body)
  if (!parsed.success) return reply(400, { error: 'invalid_request' })
  const grade = parsed.data.grade as Grade
  if (!GRADES.includes(grade)) return reply(400, { error: 'invalid_request' })
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return reply(503, { error: 'unavailable' })
  if (!aiConfigured(env)) return reply(503, { error: 'ai_not_configured' })

  // The activity, as THIS caller may see it. A guest uses the public key and reaches open lessons only.
  const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? env.SUPABASE_ANON_KEY
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  let activity: { title?: string; kind?: string; content?: { body?: string; transcript?: string; embedUrl?: string } }
  try {
    const res = await f(`${base}/rest/v1/rpc/get_activity`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_activity_id: parsed.data.activity_id }),
    })
    if (res.status === 401) return reply(401, { error: 'unauthorized' })
    if (!res.ok) return reply(403, { error: 'forbidden' })
    activity = (await res.json()) as typeof activity
  } catch {
    return reply(503, { error: 'unavailable' })
  }
  if (activity.kind !== 'reading' && activity.kind !== 'video') return reply(400, { error: 'not_supported' })

  let material = activity.kind === 'reading' ? activity.content?.body ?? '' : activity.content?.transcript ?? ''
  if (activity.kind === 'video') {
    const id = videoIdOf(activity.content?.embedUrl)
    if (id) {
      try {
        const t = await handleTranscript(new Request(`https://internal/api/transcript?videoId=${id}`), env, { fetch: f })
        if (t.ok) {
          const segs = ((await t.json()) as { segments?: { text: string }[] }).segments ?? []
          const full = segs.map((s) => s.text).join(' ').trim()
          if (full.length > material.length) material = full
        }
      } catch { /* the author's summary is still there */ }
    }
  }
  material = material.replace(/\s+\n/g, '\n').trim().slice(0, MAX_MATERIAL_CHARS)
  const title = activity.title ?? 'Lesson'
  if (material.length < 40) return reply(422, { error: 'not_enough_material' })

  const key = `${CACHE_VERSION}:${parsed.data.activity_id}:${grade}:${await sha256(material)}`
  const hit = await deps.cache?.get(key)
  const cached = Simplified.safeParse(hit)
  if (cached.success) return reply(200, { ...cached.data, grade, source: 'cache' })

  const answer = await completeJson(env, f, SYSTEM_PROMPT, buildPrompt(grade, title, material), { timeoutMs: 30_000, maxTokens: 3000 })
  const out = Simplified.safeParse(answer)
  if (!out.success) return reply(502, { error: 'ai_unusable' })
  // Grades 1-2 get no glossary, whatever the model sent.
  const result = RUBRIC[grade].band === 'K-2' ? { ...out.data, keyTerms: [] } : out.data
  await deps.cache?.put(key, result)
  return reply(200, { ...result, grade, source: 'ai' })
}
