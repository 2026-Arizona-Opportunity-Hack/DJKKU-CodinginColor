// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DraftTestsRequest, handleDraftTests, materialText, toAssessments } from './draftTests'

const req = DraftTestsRequest.parse({
  title: 'Python basics',
  lessons: [
    { title: 'Variables', activities: [{ kind: 'reading', title: 'Naming things', conceptId: 'variables', text: 'A variable gives a value a name.' }] },
    { title: 'Loops', activities: [{ kind: 'video', title: 'Watch loops', conceptId: 'loops', text: '', youtubeUrl: 'https://youtu.be/aaaaaaaaaaa' }] },
  ],
  concepts: [{ id: 'variables', name: 'Variables' }, { id: 'loops', name: 'Loops' }],
  pairs: 3,
})

const mcq = (answer: number, prompt = 'After `x = 3` and `x = x + 2`, what is x?') => ({ type: 'mcq', prompt, choices: ['5', '3', '32', 'x'], answer, explanation: 'x + 2 uses the old x' })
const short = (prompt = 'Which keyword starts a loop that repeats while something is true?') => ({ type: 'short_answer', prompt, accepted: ['while'] })
const KEY_FIELDS = /correctChoiceId|accepted|correctOrder|blanks|explanation/

describe('materialText', () => {
  it('lists lessons and activities, and fills an empty video with its fetched transcript', () => {
    const text = materialText(req, { aaaaaaaaaaa: 'In this video a for loop repeats a block.' })
    expect(text).toContain('Module: Python basics')
    expect(text).toContain('Lesson 2: Loops')
    expect(text).toContain('A variable gives a value a name.')
    expect(text).toContain('a for loop repeats a block')
  })

  it('stays under the size cap for a huge module', () => {
    const big = { ...req, lessons: [{ title: 'L', activities: Array.from({ length: 40 }, (_, i) => ({ kind: 'reading', title: `R${i}`, text: 'x'.repeat(5000), conceptId: null, youtubeUrl: null })) }] }
    expect(materialText(big).length).toBeLessThanOrEqual(14_000)
  })
})

describe('toAssessments', () => {
  it('turns pairs into real pre and post items with the same pair key, and keeps keys out of content', () => {
    const out = toAssessments({ pairs: [{ concept: 'variables', pre: mcq(0), post: mcq(0, 'After `y = 10` and `y = y - 4`, what is y?') }, { concept: 'loops', pre: short(), post: short('Which keyword starts a loop over each item?') }] }, req)
    expect(out.pre.items.map((i) => i.pairKey)).toEqual(['p1', 'p2'])
    expect(out.post.items.map((i) => i.pairKey)).toEqual(['p1', 'p2'])
    expect(out.pre.items[0]!.question.content).toMatchObject({ type: 'mcq', conceptId: 'variables' })
    expect(out.pre.items[1]!.question.key).toMatchObject({ type: 'short_answer', accepted: ['while'], caseSensitive: false })
    for (const item of [...out.pre.items, ...out.post.items]) expect(JSON.stringify(item.question.content)).not.toMatch(KEY_FIELDS)
    expect(out.dropped).toBe(0)
  })

  it('moves the right answer away from always being first', () => {
    const out = toAssessments({ pairs: [0, 1, 2].map(() => ({ concept: 'variables', pre: mcq(0), post: mcq(0) })) }, req)
    const keys = out.pre.items.map((i) => (i.question.key as { correctChoiceId: string }).correctChoiceId)
    expect(new Set(keys).size).toBeGreaterThan(1)
    for (const item of out.pre.items) {
      const k = item.question.key as { correctChoiceId: string }
      const c = item.question.content as { choices: { id: string; text: string }[] }
      expect(c.choices.find((x) => x.id === k.correctChoiceId)!.text).toBe('5') // still the right answer
    }
  })

  it('drops a pair when either side is broken, and tags unknown concepts with one from the module', () => {
    const out = toAssessments({ pairs: [
      { concept: 'variables', pre: mcq(9), post: mcq(0) },               // answer out of range
      { concept: 'loops', pre: { type: 'essay', prompt: 'x' }, post: short() }, // unsupported type
      { concept: 'made-up', pre: mcq(1), post: mcq(1) },                  // unknown concept
    ] }, req)
    expect(out.pre.items).toHaveLength(1)
    expect(out.dropped).toBe(2)
    expect(out.pre.items[0]!.question.content).toMatchObject({ conceptId: 'variables' })
  })

  it('returns nothing for a reply that is not the expected shape', () => {
    expect(toAssessments({ questions: [] }, req).pre.items).toEqual([])
    expect(toAssessments(null, req).pre.items).toEqual([])
  })
})

describe('POST /api/draft-tests', () => {
  const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon', AI_GATEWAY_URL: 'https://ai.test/v1', AI_GATEWAY_KEY: 'k' }
  const sent: { url: string; body: string }[] = []
  const fake = (opts: { author?: boolean; user?: boolean; ai?: unknown } = {}): typeof fetch => async (input, init) => {
    const url = String(input)
    sent.push({ url, body: String(init?.body ?? '') })
    if (url.endsWith('/auth/v1/user')) return opts.user === false ? new Response('{}', { status: 401 }) : Response.json({ id: 'u1' })
    if (url.endsWith('/rpc/is_author')) return Response.json(opts.author ?? true)
    if (url.startsWith('https://ai.test/v1')) return Response.json({ choices: [{ message: { content: typeof opts.ai === 'string' ? opts.ai : JSON.stringify(opts.ai) } }] })
    return new Response('not found', { status: 404 })
  }
  const post = (body: unknown, token: string | null = 'tok') =>
    new Request('https://x/api/draft-tests', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) })
  const good = { pairs: [{ concept: 'variables', pre: mcq(0), post: mcq(1) }, { concept: 'loops', pre: short(), post: short() }, { concept: 'loops', pre: mcq(2), post: mcq(3) }] }

  it('drafts paired tests for an author, sending the material and nothing about students', async () => {
    sent.length = 0
    const res = await handleDraftTests(post(req), ENV, { fetch: fake({ ai: good }) })
    expect(res.status).toBe(200)
    const out = (await res.json()) as { pre: { items: unknown[] }; post: { items: unknown[] }; dropped: number }
    expect(out.pre.items).toHaveLength(3)
    expect(out.post.items).toHaveLength(3)
    const ai = sent.find((s) => s.url.startsWith('https://ai.test'))!
    expect(ai.body).toContain('A variable gives a value a name.')
    expect(ai.body).not.toMatch(/Bearer|\btok\b|\\"anon\\"|\bu1\b/) // no token, key or user id reaches the model
  })

  it('accepts a reply wrapped in prose or a code fence', async () => {
    const res = await handleDraftTests(post(req), ENV, { fetch: fake({ ai: 'Here you go:\n```json\n' + JSON.stringify(good) + '\n```' }) })
    expect(res.status).toBe(200)
  })

  it('answers 401 without a token or with a bad one, and 403 for someone who is not an author', async () => {
    expect((await handleDraftTests(post(req, null), ENV, { fetch: fake({ ai: good }) })).status).toBe(401)
    expect((await handleDraftTests(post(req), ENV, { fetch: fake({ user: false, ai: good }) })).status).toBe(401)
    sent.length = 0
    expect((await handleDraftTests(post(req), ENV, { fetch: fake({ author: false, ai: good }) })).status).toBe(403)
    expect(sent.some((s) => s.url.startsWith('https://ai.test'))).toBe(false)
  })

  it('answers 503 when no AI provider is configured, 400 for a bad body and 413 for a huge one', async () => {
    expect((await handleDraftTests(post(req), { SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon' }, { fetch: fake() })).status).toBe(503)
    expect((await handleDraftTests(post('{bad'), ENV, { fetch: fake() })).status).toBe(400)
    expect((await handleDraftTests(post({ ...req, pairs: 50 }), ENV, { fetch: fake() })).status).toBe(400)
    expect((await handleDraftTests(post('x'.repeat(210_000)), ENV, { fetch: fake() })).status).toBe(413)
  })

  it('answers 502 when the AI fails or gives nothing usable', async () => {
    expect((await handleDraftTests(post(req), ENV, { fetch: fake({ ai: 'no json here' }) })).status).toBe(502)
    expect((await handleDraftTests(post(req), ENV, { fetch: fake({ ai: { pairs: [{ pre: { type: 'essay' }, post: {} }] } }) })).status).toBe(502)
  })
})
