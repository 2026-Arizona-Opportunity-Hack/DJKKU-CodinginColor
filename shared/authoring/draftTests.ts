import { z } from 'zod'
import { aiConfigured, completeJson, type AiEnv } from '../ai/complete'
import { authorize } from '../sources/handler'
import { handleTranscript, type TranscriptEnv } from '../transcript/handler'
import { assessmentItem, parseYouTubeId, type AuthoredAssessment } from './schemas'

// POST /api/draft-tests: draft a paired pre-test and post-test from a module's own material, for the
// author to review. Lives here, not in functions/, so it can be tested without Cloudflare.
//
// Only curriculum is sent to the AI (lesson titles, readings, video transcripts, code tasks, question
// prompts). No student data exists in a draft module and none is read. Nothing is saved: the studio puts
// the draft into the editor, the author edits it, and the usual save, submit and publish rules apply.
// Which AI provider and model answer is set by the deployment (see shared/ai/complete.ts).

export const MIN_PAIRS = 3
export const MAX_PAIRS = 10
const MAX_BODY_CHARS = 200_000
const MAX_MATERIAL_CHARS = 14_000
const MAX_PER_ACTIVITY = 2_500
const MAX_VIDEO_TRANSCRIPTS = 5

// ---------- the request: the module as it is on screen ----------

const activity = z.object({
  kind: z.string().max(20),
  title: z.string().max(200),
  conceptId: z.string().max(64).nullish(),
  /** Reading body, transcript, code task or question prompts: whatever text the activity has. */
  text: z.string().max(60_000).default(''),
  youtubeUrl: z.string().max(500).nullish(),
})
export const DraftTestsRequest = z
  .object({
    title: z.string().trim().min(1).max(120),
    summary: z.string().max(500).default(''),
    lessons: z.array(z.object({ title: z.string().max(120), activities: z.array(activity).max(60) })).min(1).max(20),
    /** Concepts the questions may be tagged with: the catalog, so tags match what instructors filter on. */
    concepts: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), name: z.string().max(80) })).min(1).max(100),
    pairs: z.number().int().min(MIN_PAIRS).max(MAX_PAIRS).default(5),
  })
  .strict()
export type DraftTestsRequest = z.infer<typeof DraftTestsRequest>

export const DraftTestsResponse = z.object({
  pre: z.object({ kind: z.literal('pre'), items: z.array(z.unknown()) }),
  post: z.object({ kind: z.literal('post'), items: z.array(z.unknown()) }),
  dropped: z.number(),
  usedTranscripts: z.number(),
})
export type DraftTestsResponse = { pre: AuthoredAssessment; post: AuthoredAssessment; dropped: number; usedTranscripts: number }

// ---------- material and prompt ----------

/** The module as plain text for the model, capped so a long module still fits. */
export function materialText(req: DraftTestsRequest, transcripts: Record<string, string> = {}): string {
  const out: string[] = [`Module: ${req.title}`]
  if (req.summary.trim()) out.push(`Summary: ${req.summary.trim()}`)
  req.lessons.forEach((l, i) => {
    out.push(`\nLesson ${i + 1}: ${l.title}`)
    for (const a of l.activities) {
      const videoId = a.kind === 'video' ? parseYouTubeId(a.youtubeUrl ?? '') : null
      const body = (a.text.trim() || (videoId ? transcripts[videoId] ?? '' : '')).replace(/\s+/g, ' ').slice(0, MAX_PER_ACTIVITY)
      out.push(`- ${a.kind}: ${a.title}${a.conceptId ? ` [concept: ${a.conceptId}]` : ''}${body ? `\n  ${body}` : ''}`)
    }
  })
  return out.join('\n').slice(0, MAX_MATERIAL_CHARS)
}

export const SYSTEM_PROMPT = [
  'You write fair pre-tests and post-tests for a free coding course for high school students (ages 14 to 18), many new to coding.',
  'Test only what the module material teaches. Use plain, friendly language and short questions.',
  'Each pair measures ONE skill twice: the pre-test question and the post-test question test the same skill at the same difficulty,',
  'but with different wording and different values or code, so the post-test is not a copy.',
  'Prefer multiple choice with 4 choices and exactly one correct choice; wrong choices should be common beginner mistakes.',
  'Use short_answer only when the answer is one word, number or short expression.',
  'Put code in backticks. Never refer to "the video" or "the reading": questions must stand alone.',
  'Reply with JSON only.',
].join(' ')

export function buildPrompt(req: DraftTestsRequest, material: string): string {
  return [
    `Write ${req.pairs} pairs for this module.`,
    `Tag each pair with one concept id from this list: ${req.concepts.map((c) => `${c.id} (${c.name})`).join(', ')}.`,
    'Spread the pairs over the main skills of the module.',
    'JSON shape:',
    '{"pairs":[{"concept":"<concept id>","skill":"<what it tests>",',
    '"pre":{"type":"mcq","prompt":"...","choices":["...","...","...","..."],"answer":<index of the correct choice>,"explanation":"why"},',
    '"post":{"type":"short_answer","prompt":"...","accepted":["...","..."],"explanation":"why"}}]}',
    '',
    'MODULE MATERIAL:',
    material,
  ].join('\n')
}

// ---------- the model's answer, turned into real test items ----------

const ModelQuestion = z.union([
  z.object({ type: z.literal('mcq'), prompt: z.string(), choices: z.array(z.string()).min(2).max(6), answer: z.coerce.number().int(), explanation: z.string().optional() }),
  z.object({ type: z.literal('short_answer'), prompt: z.string(), accepted: z.array(z.coerce.string()).min(1).max(10), explanation: z.string().optional() }),
])
const ModelReply = z.object({ pairs: z.array(z.object({ concept: z.string().optional(), pre: z.unknown(), post: z.unknown() })) })

const CHOICE_IDS = ['a', 'b', 'c', 'd', 'e', 'f']

function toQuestion(raw: unknown, qid: string, conceptId: string, rotate: number) {
  const q = ModelQuestion.safeParse(raw)
  if (!q.success) return null
  const explanation = q.data.explanation?.trim().slice(0, 1000) || undefined
  if (q.data.type === 'mcq') {
    const m = q.data
    const n = m.choices.length
    if (m.answer < 0 || m.answer >= n) return null
    // Models tend to put the right answer first; rotating spreads it over the positions.
    const order = Array.from({ length: n }, (_, k) => (k + rotate) % n)
    const choices = order.map((from, k) => ({ id: CHOICE_IDS[k]!, text: m.choices[from]!.trim().slice(0, 300) }))
    const correct = CHOICE_IDS[order.indexOf(m.answer)]!
    return {
      content: { id: qid, conceptId, type: 'mcq' as const, prompt: m.prompt.trim().slice(0, 2000), choices },
      key: { type: 'mcq' as const, correctChoiceId: correct, ...(explanation ? { explanation } : {}), hints: [] },
    }
  }
  return {
    content: { id: qid, conceptId, type: 'short_answer' as const, prompt: q.data.prompt.trim().slice(0, 2000) },
    key: { type: 'short_answer' as const, accepted: q.data.accepted.map((a) => a.trim().slice(0, 200)).filter(Boolean), caseSensitive: false, ...(explanation ? { explanation } : {}), hints: [] },
  }
}

/** Valid pairs only: a pair is kept when both its questions pass the same schema the studio saves with. */
export function toAssessments(reply: unknown, req: DraftTestsRequest): { pre: AuthoredAssessment; post: AuthoredAssessment; dropped: number } {
  const parsed = ModelReply.safeParse(reply)
  const pairs = parsed.success ? parsed.data.pairs.slice(0, MAX_PAIRS) : []
  const allowed = new Set(req.concepts.map((c) => c.id))
  const fallbackConcept = req.lessons.flatMap((l) => l.activities).find((a) => a.conceptId && allowed.has(a.conceptId))?.conceptId ?? req.concepts[0]!.id
  const pre: AuthoredAssessment['items'] = []
  const post: AuthoredAssessment['items'] = []
  pairs.forEach((p, i) => {
    const conceptId = p.concept && allowed.has(p.concept) ? p.concept : fallbackConcept
    const pairKey = `p${pre.length + 1}`
    const a = assessmentItem.safeParse({ pairKey, question: toQuestion(p.pre, `ai-pre-${pairKey}`, conceptId, i) })
    const b = assessmentItem.safeParse({ pairKey, question: toQuestion(p.post, `ai-post-${pairKey}`, conceptId, i + 1) })
    if (a.success && b.success) {
      pre.push(a.data)
      post.push(b.data)
    }
  })
  return { pre: { kind: 'pre', items: pre }, post: { kind: 'post', items: post }, dropped: pairs.length - pre.length }
}

// ---------- the endpoint ----------

export type DraftTestsEnv = AiEnv & TranscriptEnv & { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }

async function fetchTranscripts(req: DraftTestsRequest, env: DraftTestsEnv, f: typeof fetch): Promise<Record<string, string>> {
  const ids = [...new Set(req.lessons.flatMap((l) => l.activities).filter((a) => a.kind === 'video' && !a.text.trim()).map((a) => parseYouTubeId(a.youtubeUrl ?? '')).filter((x): x is string => Boolean(x)))].slice(0, MAX_VIDEO_TRANSCRIPTS)
  const out: Record<string, string> = {}
  await Promise.all(ids.map(async (videoId) => {
    try {
      const res = await handleTranscript(new Request(`https://internal/api/transcript?videoId=${videoId}`), env, { fetch: f })
      if (!res.ok) return
      const body = (await res.json()) as { segments?: { text: string }[] }
      const text = (body.segments ?? []).map((s) => s.text).join(' ').trim()
      if (text) out[videoId] = text
    } catch { /* a video without a transcript still has its title */ }
  }))
  return out
}

export async function handleDraftTests(request: Request, env: DraftTestsEnv, deps: { fetch?: typeof fetch } = {}): Promise<Response> {
  const f = deps.fetch ?? fetch
  const reply = (status: number, body: unknown) => {
    console.log(JSON.stringify({ event: 'draft-tests', status })) // never the material or the token
    return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const who = await authorize(request, env, f)
  if (who !== 'ok') return reply(who, { error: who === 401 ? 'unauthorized' : who === 403 ? 'forbidden' : 'unavailable' })
  if (!aiConfigured(env)) return reply(503, { error: 'ai_not_configured' })

  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return reply(413, { error: 'too_large' })
  let body: unknown
  try { body = JSON.parse(text) } catch { return reply(400, { error: 'invalid_request' }) }
  const parsed = DraftTestsRequest.safeParse(body)
  if (!parsed.success) return reply(400, { error: 'invalid_request' })
  const req = parsed.data

  const transcripts = await fetchTranscripts(req, env, f)
  const material = materialText(req, transcripts)
  const answer = await completeJson(env, f, SYSTEM_PROMPT, buildPrompt(req, material))
  if (answer === null) return reply(502, { error: 'ai_unavailable' })
  const result = toAssessments(answer, req)
  if (result.pre.items.length === 0) return reply(502, { error: 'ai_unusable' })
  return reply(200, { ...result, usedTranscripts: Object.keys(transcripts).length })
}
