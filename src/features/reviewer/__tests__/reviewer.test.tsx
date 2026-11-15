// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewerPage } from '../ReviewerPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const h = vi.hoisted(() => ({ sb: undefined as unknown, me: { data: { role: 'reviewer' } as { role: string }, isPending: false } }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))
vi.mock('@/lib/session', async (orig) => ({ ...(await orig<typeof import('@/lib/session')>()), useMe: () => h.me, isDemoMode: () => false }))

const KEY_FIELDS = /correctChoiceId|"accepted"|"blanks"|correctOrder|"hints"|"explanation"/
const ID = '30000000-0000-4000-8000-000000000001'
const mcq = (id: string, text = 'Pick one') => ({ type: 'mcq', id, prompt: text, conceptId: 'loops', choices: [{ id: 'a', text: 'Right one' }, { id: 'b', text: 'Wrong one' }] })

const SUMMARY = [{ id: ID, title: 'Variables and Loops', version: 2, summary: 'A starter module.', published_at: '2026-11-14T00:00:00Z',
  lessons: [{ activities: [{ concept_id: 'loops' }, { concept_id: null }] }, { activities: [{ concept_id: 'variables' }] }],
  assessments: [{ assessment_items: [{ concept_id: 'loops' }] }] }]
const FULL = { id: ID, title: 'Variables and Loops', version: 2, summary: 'A starter module.', published_at: '2026-11-14T00:00:00Z',
  lessons: [{ id: 'l1', position: 0, title: 'Basics', activities: [
    { id: 'a1', position: 0, kind: 'video', title: 'Watch', required: true, concept_id: 'variables', content: { embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', transcript: 'Words here' } },
    { id: 'a2', position: 1, kind: 'reading', title: 'Read', required: false, concept_id: null, content: { body: '## Heading\n\n**bold** <b id="raw">html</b>' } },
    { id: 'a3', position: 2, kind: 'check', title: 'Check', required: true, concept_id: 'loops', content: { questions: [mcq('q1'), { type: 'short_answer', id: 'q2', prompt: 'Keyword?', conceptId: 'loops' }] } },
    { id: 'a4', position: 3, kind: 'worksheet', title: 'Sheet', required: true, concept_id: null, content: { questions: [{ type: 'fill_blank', id: 'q3', prompt: 'A ___ repeats', conceptId: 'loops' }, { type: 'ordering', id: 'q4', prompt: 'Order', conceptId: 'loops', items: [{ id: 'i2', text: 'Two' }, { id: 'i1', text: 'One' }] }] } },
    { id: 'a5', position: 4, kind: 'exit', title: 'Exit', required: true, concept_id: null, content: { questions: [{ type: 'reflection', id: 'q5', prompt: 'What was hard?' }] } },
  ] }],
  assessments: [
    { kind: 'pre', assessment_items: [{ position: 0, pair_key: 'p1', concept_id: 'loops', content: mcq('pre-1', 'Pre wording') }, { position: 1, pair_key: 'p2', concept_id: 'loops', content: mcq('pre-2', 'Only on pre') }] },
    { kind: 'post', assessment_items: [{ position: 0, pair_key: 'p1', concept_id: 'loops', content: mcq('post-1', 'Post wording') }] },
  ] }

/** A stand-in client: from(table) answers with canned rows, and every rpc call is recorded. */
function fake(opts: { summary?: unknown; full?: unknown; error?: unknown } = {}) {
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const from = vi.fn((table: string) => {
    const data = table === 'concepts' ? [{ id: 'loops', name: 'Loops' }, { id: 'variables', name: 'Variables' }] : (opts.summary ?? SUMMARY)
    const result = { data: opts.error ? null : data, error: opts.error ?? null }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) chain[m] = () => chain
    chain.maybeSingle = async () => ({ data: opts.error ? null : ('full' in opts ? opts.full : FULL), error: opts.error ?? null })
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok)
    return chain
  })
  h.sb = { from, rpc }
  return { rpc, from }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.me.data = { role: 'reviewer' }
})

describe('who can review', () => {
  it('turns everyone else away and reads nothing', () => {
    h.me.data = { role: 'instructor' }
    const { from } = fake()
    renderAt(<ReviewerPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('This page is for curriculum reviewers.')
    expect(from).not.toHaveBeenCalled()
  })

  it.each(['reviewer', 'cic_admin'])('lets %s in and always shows the read-only banner', async (role) => {
    h.me.data = { role }
    fake()
    renderAt(<ReviewerPage />)
    expect(await screen.findByText('Read-only. Answer keys and student data are hidden by design.')).toBeInTheDocument()
  })
})

describe('module list', () => {
  it('lists published modules with counts and concepts, and searches by title', async () => {
    fake()
    const { container } = renderAt(<ReviewerPage />)
    const card = (await screen.findByRole('heading', { name: /Variables and Loops/ })).closest('li') as HTMLElement
    expect(within(card).getByText('2 lessons, 3 activities')).toBeInTheDocument()
    expect(within(card).getByText('Concepts: Loops, Variables')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Variables and Loops' })).toHaveAttribute('href', `/review/${ID}`)
    await expectNoSeriousA11yViolations(container)
    await userEvent.type(screen.getByLabelText('Search by title'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent('No module title matches "zzz".')
    await userEvent.clear(screen.getByLabelText('Search by title'))
    await userEvent.type(screen.getByLabelText('Search by title'), 'loops')
    expect(screen.getByRole('link', { name: 'Variables and Loops' })).toBeInTheDocument()
  })

  it('has empty and error states', async () => {
    fake({ summary: [] })
    renderAt(<ReviewerPage />)
    expect(await screen.findByText(/No published modules yet/)).toBeInTheDocument()
  })

  it('shows an error with Try again', async () => {
    fake({ error: { code: '42501', message: 'denied' } })
    renderAt(<ReviewerPage />)
    expect(await screen.findByText(/We could not load published modules/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('module walkthrough', () => {
  it('renders every activity kind as a student sees it, and the tests by pair key', async () => {
    fake()
    const { container } = renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    expect(await screen.findByRole('heading', { name: /Variables and Loops/ })).toBeInTheDocument()
    expect(screen.getByTitle('Video: Watch')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/dQw4w9WgXcQ'))
    expect(screen.getByText('Read the transcript')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument() // markdown
    expect(container.querySelector('#raw')).toBeNull() // raw HTML is not rendered
    expect(screen.getAllByText('Right one').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Your answer').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Blank 1')).toBeInTheDocument()
    expect(screen.getByText('What was hard?')).toBeInTheDocument()
    expect(screen.getByText(/optional/)).toBeInTheDocument()
    const pair1 = screen.getByRole('heading', { name: /Pair p1/ }).closest('div') as HTMLElement
    expect(within(pair1).getByText('Pre wording')).toBeInTheDocument()
    expect(within(pair1).getByText('Post wording')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: /Pair p2/ }).closest('div') as HTMLElement).getByText('No matching item on the post-test.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('never calls an answer-key or write function, never shows a key, and has no write controls', async () => {
    const { rpc, from } = fake()
    const { container } = renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    await screen.findByRole('heading', { name: /Variables and Loops/ })
    expect(rpc).not.toHaveBeenCalled() // no get_activity_keys, get_assessment_keys, publish, save, anything
    for (const call of from.mock.results) expect(Object.keys(call.value)).not.toEqual(expect.arrayContaining(['insert', 'update', 'delete', 'upsert']))
    expect(container.innerHTML).not.toMatch(KEY_FIELDS)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
  })

  it('refuses to show content that has a key field smuggled into it', async () => {
    const bad = structuredClone(FULL)
    ;((bad.lessons[0]!.activities[2]!.content as { questions: Record<string, unknown>[] }).questions[0]!).correctChoiceId = 'a'
    fake({ full: bad })
    const { container } = renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    expect(await screen.findByText("This activity's content could not be shown.")).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/correctChoiceId/)
  })

  it('says so when the module is not published or not found', async () => {
    fake({ full: null })
    renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    expect(await screen.findByText(/We couldn't find that module/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to published modules' })).toHaveAttribute('href', '/review')
  })
})
