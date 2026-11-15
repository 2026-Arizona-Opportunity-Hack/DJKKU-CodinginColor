import { z } from 'zod'
import { normalizedAnswer, pickQuestion, readableAnswer, revealsAnswer, type StudentResponse, type Target } from './grade'

// POST /api/hint. Lives here, not in functions/, so it can be tested without Cloudflare.
//
// The order matters. First prove who is asking and that they may see this activity (with THEIR token,
// never the service role). Only then use the service role, and only for: the answer key (to rank
// hints and to refuse an AI hint that gives the answer away), the hint cache and the hint log.
// The model only ever sees the question and the student's answer, with no name, class, school or id.

export const MAX_HINTS = 3
export const MODEL = 'gemini-3.5-flash-lite' // stable, free tier; checked against the Gemini docs on 2026-11-14
/** A hint request is an activity id and one answer: 16 KB is far more than any real one. */
const MAX_BODY_CHARS = 16_384
const GEMINI_URL = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
const AI_TIMEOUT_MS = 4000
const MAX_HINT_CHARS = 300
const FALLBACK_HINT = 'Re-read the question and try one part at a time.'
const SYSTEM_PROMPT =
  'You are a kind coding tutor for a 14 year old. Give exactly one Socratic nudge in at most 2 short sentences, in plain language. ' +
  "Never reveal, state or confirm the correct answer, and never say whether the student's answer is right. Point at what to look at next."

export interface HintEnv {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  GEMINI_API_KEY?: string
  /** An OpenAI-compatible gateway (e.g. https://ai.ohack.dev/v1). Used instead of Gemini when URL and key are set. */
  AI_GATEWAY_URL?: string
  AI_GATEWAY_KEY?: string
  /** Defaults to gpt-oss-120b: on the OHack gateway it is the model whose prompts are not used for training. */
  AI_MODEL?: string
}

export const GATEWAY_MODEL = 'gpt-oss-120b'
const GATEWAY_TIMEOUT_MS = 8000 // a larger model than Flash-Lite; the player waits up to 15 s
type Provider = { kind: 'gateway'; url: string; key: string; model: string } | { kind: 'gemini'; key: string }
/** Gateway if set, else Gemini if it has a key, else none (the written ladder). */
export function providerOf(env: HintEnv): Provider | null {
  if (env.AI_GATEWAY_URL && env.AI_GATEWAY_KEY) {
    return { kind: 'gateway', url: env.AI_GATEWAY_URL.replace(/\/$/, ''), key: env.AI_GATEWAY_KEY, model: env.AI_MODEL || GATEWAY_MODEL }
  }
  return env.GEMINI_API_KEY ? { kind: 'gemini', key: env.GEMINI_API_KEY } : null
}
export interface HintDeps {
  fetch?: typeof fetch
}

const Body = z.object({ activity_id: z.string().uuid(), response: z.record(z.string(), z.unknown()) }).strict()
type Source = 'ladder' | 'ai' | 'cache'

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function handleHint(request: Request, env: HintEnv, deps: HintDeps = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const reply = (status: number, body: unknown, source?: Source) => {
    // Only the request id, the status and the source are logged: never the token, the answer or the key.
    console.log(JSON.stringify({ event: 'hint', requestId, status, source }))
    return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'x-request-id': requestId } })
  }
  const fail = (status: number, error: string) => reply(status, { error })

  // 1. The body.
  // Size is checked before parsing, so an oversized body never reaches JSON.parse or zod.
  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_CHARS) return fail(413, 'too_large')
    raw = JSON.parse(text)
  } catch {
    return fail(400, 'invalid_request')
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success || JSON.stringify(parsed.data.response).length > 4096) return fail(400, 'invalid_request')
  const { activity_id: activityId, response } = parsed.data as { activity_id: string; response: StudentResponse }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return fail(503, 'unavailable')
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const service = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

  try {
    // 2. Who is asking? Their own token, checked by Supabase Auth.
    const token = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) return fail(401, 'unauthorized')
    const who = await f(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
    const userId = who.ok ? ((await who.json()) as { id?: string }).id : undefined
    if (!userId) return fail(401, 'unauthorized')

    // 2b. May they see this activity? get_activity, called with THEIR token, refuses a locked or foreign one.
    const act = await f(`${base}/rest/v1/rpc/get_activity`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_activity_id: activityId }),
    })
    if (!act.ok) return fail(403, 'forbidden')
    const activity = (await act.json()) as { kind?: string; content?: { questions?: unknown } }
    if (!['check', 'worksheet', 'exit'].includes(activity.kind ?? '')) return fail(400, 'no_hints_here')

    // 3. Their hints so far (service role).
    const get = async (path: string) => {
      const r = await f(`${base}/rest/v1/${path}`, { headers: service })
      if (!r.ok) throw new Error(`read ${r.status}`)
      return (await r.json()) as Record<string, unknown>[]
    }
    const used = (await get(`hint_events?student_id=eq.${userId}&activity_id=eq.${activityId}&select=id&limit=${MAX_HINTS + 1}`)).length
    if (used >= MAX_HINTS) return fail(429, 'rate_limited')

    // The key and the question this hint is about.
    const keys = (await get(`activity_keys?activity_id=eq.${activityId}&select=question_id,key`)) as { question_id: string; key: unknown }[]
    const target = pickQuestion(activity.content?.questions, keys, response)
    if (!target) return fail(400, 'no_hints_here')

    // 4. Cache, then 5. the model, then 6. the written ladder.
    const hash = await sha256(`${activityId}|${target.question.id}|${normalizedAnswer(target)}`)
    let hint: string | undefined
    let source: Source = 'ladder'
    const cached = await get(`hint_cache?activity_id=eq.${activityId}&wrong_answer_hash=eq.${hash}&select=hint&limit=1`)
    if (typeof cached[0]?.hint === 'string') {
      hint = cached[0].hint
      source = 'cache'
    } else if (providerOf(env)) {
      const ai = await askModel(f, providerOf(env)!, target)
      if (ai) {
        hint = ai
        source = 'ai'
        await f(`${base}/rest/v1/hint_cache`, {
          method: 'POST',
          headers: { ...service, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ activity_id: activityId, wrong_answer_hash: hash, hint: ai }),
        }).catch(() => undefined) // a cache miss next time is fine
      }
    }
    if (!hint) {
      const ladder = 'hints' in target.key ? target.key.hints : []
      hint = ladder[used] ?? FALLBACK_HINT
      source = 'ladder'
    }

    // 7. Log it. class_id comes from the student's roster seat.
    const seat = await get(`class_members?profile_id=eq.${userId}&member_role=eq.student&select=class_id&limit=1`)
    const classId = seat[0]?.class_id
    if (typeof classId === 'string') {
      const conceptId = 'conceptId' in target.question ? target.question.conceptId : null
      await f(`${base}/rest/v1/hint_events`, {
        method: 'POST',
        headers: { ...service, Prefer: 'return=minimal' },
        body: JSON.stringify({ student_id: userId, class_id: classId, activity_id: activityId, attempt: used + 1, hint, concept_id: conceptId }),
      }).catch(() => undefined)
    }
    return reply(200, { hint, source, remaining: MAX_HINTS - (used + 1) }, source)
  } catch {
    // Only the database can get us here (the model has its own fallback). Say so plainly.
    return fail(503, 'unavailable')
  }
}

/** One nudge from the model, or null for any problem: timeout, rate limit, bad shape, too long, or it gave the answer away. */
async function askModel(f: typeof fetch, provider: Provider, t: Target): Promise<string | null> {
  const q = t.question
  const lines = [`Question: ${q.prompt}`]
  if (q.type === 'mcq') lines.push(`Choices: ${q.choices.map((c) => c.text).join(' | ')}`)
  if (q.type === 'ordering') lines.push(`Items to put in order: ${q.items.map((i) => i.text).join(' | ')}`)
  lines.push(`The student answered: ${readableAnswer(t)}`)
  try {
    const raw = provider.kind === 'gateway' ? await askGateway(f, provider, lines.join('\n')) : await askGemini(f, provider.key, lines.join('\n'))
    const text = (raw ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > MAX_HINT_CHARS || revealsAnswer(text, t)) return null
    return text
  } catch {
    return null
  }
}

async function askGemini(f: typeof fetch, apiKey: string, prompt: string): Promise<string | null> {
  const res = await f(GEMINI_URL(MODEL), {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 120, thinkingConfig: { thinkingLevel: 'minimal' } },
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
  return (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join(' ')
}

/**
 * The OpenAI-style chat completions call the OHack gateway speaks. Only standard fields are sent, so
 * any OpenAI-compatible gateway accepts it. gpt-oss reasons before it answers, so it gets room
 * (max_tokens 1000); only `message.content`, the final answer, is used, never the reasoning.
 */
async function askGateway(f: typeof fetch, p: { url: string; key: string; model: string }, prompt: string): Promise<string | null> {
  const res = await f(`${p.url}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
  const content = data.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : null
}
