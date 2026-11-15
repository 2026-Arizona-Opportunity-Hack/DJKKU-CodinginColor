// @vitest-environment jsdom
import '../test/setup'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, fakeSupabase, renderAt } from '../test/harness'
import { ReviewerPage } from '../ReviewerPage'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const MODULE_ID = '33333333-3333-4333-8333-333333333333'
const choice = (id: string, text: string) => ({ id, text })

const LIST = [
  {
    id: MODULE_ID, slug: 'variables-and-loops', version: 2, title: 'Variables and Loops',
    summary: 'Store values and repeat steps.', published_at: '2026-11-14T20:00:00Z',
    lessons: [{ id: 'l1', activities: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'l2', activities: [{ id: 'a3' }] }],
  },
]

const DETAIL = {
  id: MODULE_ID, slug: 'variables-and-loops', version: 2, title: 'Variables and Loops',
  summary: 'Store values and repeat steps.', published_at: '2026-11-14T20:00:00Z',
  lessons: [
    {
      id: 'l1', position: 0, title: 'Variables',
      activities: [
        // positions deliberately out of order: the page must sort them
        {
          id: 'a2', position: 1, kind: 'reading', title: 'What is a variable?', required: true, concept_id: null,
          content: { body: 'A variable is a name for a value.\n<script>document.title="pwned"</script>' },
        },
        {
          id: 'a1', position: 0, kind: 'video', title: 'Watch: variables', required: true, concept_id: 'variables',
          content: { embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk', transcript: 'Hello class, today variables.' },
        },
        {
          id: 'a3', position: 2, kind: 'check', title: 'Variables check', required: true, concept_id: 'variables',
          content: {
            questions: [
              { id: 'q1', type: 'mcq', prompt: 'After x = 3 and x = x + 2, what is x?', conceptId: 'variables',
                choices: [choice('c1', '3'), choice('c2', '5'), choice('c3', '32')] },
            ],
          },
        },
        {
          id: 'a4', position: 3, kind: 'worksheet', title: 'Practice', required: false, concept_id: 'loops',
          content: {
            questions: [
              { id: 'q2', type: 'fill_blank', prompt: 'A ___ repeats steps.', conceptId: 'loops' },
              { id: 'q3', type: 'ordering', prompt: 'Order the steps.', conceptId: 'loops',
                items: [choice('i1', 'Start'), choice('i2', 'Repeat'), choice('i3', 'Stop')] },
              { id: 'q4', type: 'short_answer', prompt: 'Define a loop.', conceptId: 'loops' },
            ],
          },
        },
        {
          id: 'a5', position: 4, kind: 'exit', title: 'Exit question', required: true, concept_id: null,
          content: { questions: [{ id: 'q5', type: 'reflection', prompt: 'What was hardest today?' }] },
        },
      ],
    },
  ],
  assessments: [
    {
      id: 't2', kind: 'post', title: 'Variables and Loops post-test',
      assessment_items: [
        { id: 'p1', position: 0, pair_key: 'pair-1', concept_id: 'loops',
          content: { id: 'pq1', type: 'mcq', prompt: 'Which repeats code? (post)', conceptId: 'loops', choices: [choice('a', 'for'), choice('b', 'if')] } },
      ],
    },
    {
      id: 't1', kind: 'pre', title: 'Variables and Loops pre-test',
      assessment_items: [
        { id: 'r1', position: 0, pair_key: 'pair-1', concept_id: 'loops',
          content: { id: 'rq1', type: 'mcq', prompt: 'Which repeats code? (pre)', conceptId: 'loops', choices: [choice('a', 'for'), choice('b', 'if')] } },
      ],
    },
  ],
}

const CONCEPTS = [{ id: 'variables', name: 'Variables' }, { id: 'loops', name: 'Loops' }]

// A loosely typed copy of DETAIL that a test can change (swap one activity's content, and so on).
interface Editable { lessons: { activities: { content: Record<string, unknown> }[] }[] }
const clone = () => structuredClone(DETAIL) as unknown as Editable

const show = (tables: Parameters<typeof fakeSupabase>[0]) => {
  const sb = fakeSupabase({ concepts: { data: CONCEPTS }, ...tables })
  h.sb = sb
  return sb
}
const openList = () => renderAt(<ReviewerPage />, { path: '/review/*', url: '/review' })
const openModule = (id = MODULE_ID) => renderAt(<ReviewerPage />, { path: '/review/*', url: `/review/${id}` })

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321'))

describe('module list', () => {
  it('lists published modules with counts and a link to each', async () => {
    show({ modules: { data: LIST } })
    openList()
    const link = await screen.findByRole('link', { name: 'Variables and Loops' })
    expect(link).toHaveAttribute('href', `/review/${MODULE_ID}`)
    expect(screen.getByText(/Version 2/)).toHaveTextContent('2 lessons, 3 activities')
    expect(screen.getByText('Store values and repeat steps.')).toBeInTheDocument()
  })

  it('says so when nothing is published yet', async () => {
    show({ modules: { data: [] } })
    openList()
    expect(await screen.findByText(/no published modules to review yet/i)).toBeInTheDocument()
  })

  it('shows a friendly error with a way to retry', async () => {
    let fail = true
    show({ modules: () => (fail ? { error: { message: 'boom internal detail', code: 'XX000' } } : { data: LIST }) })
    openList()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The modules did not load')
    expect(alert).not.toHaveTextContent('boom internal detail')
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Variables and Loops' })).toBeInTheDocument()
  })

  it('states clearly that it is read only and hides keys and student data', async () => {
    show({ modules: { data: LIST } })
    openList()
    expect(await screen.findByRole('note')).toHaveTextContent(/read only.*never shown/i)
  })

  it('has no serious accessibility problems', async () => {
    show({ modules: { data: LIST } })
    const { container } = openList()
    await screen.findByRole('link', { name: 'Variables and Loops' })
    await expectNoSeriousA11yViolations(container)
  })
})

describe('module view', () => {
  it('shows lessons and activities in the order a student meets them, with kinds and concepts', async () => {
    show({ modules: { data: [DETAIL] } })
    openModule()
    expect(await screen.findByRole('heading', { level: 2, name: 'Variables and Loops' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Lesson 1: Variables' })).toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 5 }).map((e) => e.textContent ?? '')
    expect(titles.map((t) => t.split(' (')[0].trim())).toEqual([
      'Watch: variables', 'What is a variable?', 'Variables check', 'Practice', 'Exit question',
    ])
    expect(titles[0]).toContain('Video · Concept: Variables')
    expect(titles[3]).toContain('optional')
  })

  it('embeds only a privacy-enhanced YouTube video, and offers the transcript', async () => {
    show({ modules: { data: [DETAIL] } })
    openModule()
    const frame = await screen.findByTitle('Video: Watch: variables')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk')
    expect(screen.getByRole('link', { name: /Open on YouTube/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Transcript')).toBeInTheDocument()
    expect(screen.getByText('Hello class, today variables.')).toBeInTheDocument()
  })

  it('refuses to embed any other address', async () => {
    const bad = clone()
    bad.lessons[0].activities[1].content = { embedUrl: 'https://evil.example/embed/abcdefghijk' }
    show({ modules: { data: [bad] } })
    openModule()
    await screen.findByRole('heading', { level: 2, name: 'Variables and Loops' })
    expect(screen.queryByTitle(/Video:/)).not.toBeInTheDocument()
    expect(screen.getByText(/This video can't be shown here/)).toBeInTheDocument()
  })

  it('shows reading text as plain text and never runs HTML in it', async () => {
    show({ modules: { data: [DETAIL] } })
    const { container } = openModule()
    expect(await screen.findByText(/A variable is a name for a value/)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(document.title).not.toBe('pwned')
    expect(screen.getByText(/<script>/)).toBeInTheDocument()
  })

  it('renders every question type without marking any answer', async () => {
    show({ modules: { data: [DETAIL] } })
    openModule()
    await screen.findByText('After x = 3 and x = x + 2, what is x?')
    expect(screen.getByText(/Multiple choice · Concept: Variables/)).toBeInTheDocument()
    const choices = screen.getAllByRole('list', { name: 'Choices' })[0]
    expect(within(choices).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A. 3', 'B. 5', 'C. 32'])
    expect(screen.getByText(/A ___ repeats steps/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Items to put in order' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Define a loop.')).toBeInTheDocument()
    expect(screen.getByText(/Reflection \(not scored\)/)).toBeInTheDocument()
    // Checked inside the module only: the page banner itself says "answer keys ... never shown".
    expect(within(screen.getByRole('article')).queryByText(/correct|answer key|right answer/i)).toBeNull()
  })

  it('shows the pre-test before the post-test', async () => {
    show({ modules: { data: [DETAIL] } })
    openModule()
    const headings = await screen.findAllByRole('heading', { level: 4, name: /test\)$/ })
    expect(headings.map((e) => e.textContent)).toEqual([
      'Variables and Loops pre-test (pre-test)',
      'Variables and Loops post-test (post-test)',
    ])
    expect(screen.getByText('Which repeats code? (pre)')).toBeInTheDocument()
  })

  it('leaves out a question with an unexpected field instead of printing it', async () => {
    const leaky = clone()
    leaky.lessons[0].activities[2].content = {
      questions: [{ id: 'q1', type: 'mcq', prompt: 'Visible prompt?', conceptId: 'variables',
        choices: [choice('c1', 'one'), choice('c2', 'two')], answer: 'SECRET-ANSWER-C2' }],
    }
    show({ modules: { data: [leaky] } })
    openModule()
    expect(await screen.findByText(/This question can't be shown here/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('SECRET-ANSWER-C2')
  })

  it('only asks for published modules and concept names, never keys or student tables', async () => {
    const sb = show({ modules: { data: [DETAIL] } })
    openModule()
    await screen.findByRole('heading', { level: 2, name: 'Variables and Loops' })
    const tables = [...new Set(sb.calls.map((c) => c.table))].sort()
    expect(tables).toEqual(['concepts', 'modules'])
    const moduleCall = sb.calls.find((c) => c.table === 'modules')!
    expect(moduleCall.filters).toContainEqual(['status', 'published'])
    for (const forbidden of ['activity_keys', 'assessment_keys', 'submissions', 'progress', 'class_members', 'api_keys']) {
      expect(moduleCall.select).not.toContain(forbidden)
    }
  })

  it('still works when the concept names fail to load', async () => {
    show({ modules: { data: [DETAIL] }, concepts: { error: { message: 'down', code: 'XX000' } } })
    openModule()
    expect(await screen.findByRole('heading', { level: 2, name: 'Variables and Loops' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 5 })[0]).toHaveTextContent('Concept: variables')
  })

  it('explains an unknown or unpublished module, and a bad link', async () => {
    const sb = show({ modules: { data: [] } })
    openModule('99999999-9999-4999-8999-999999999999')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found, or it is not published/i)
    expect(sb.calls.some((c) => c.table === 'modules')).toBe(true)
  })

  it('does not even query the database for a link that is not a module id', async () => {
    const sb = show({ modules: { data: [DETAIL] } })
    openModule('not-a-uuid')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i)
    expect(sb.calls.filter((c) => c.table === 'modules')).toHaveLength(0)
  })

  it('has a way back to the list', async () => {
    show({ modules: { data: [DETAIL] } })
    openModule()
    expect(await screen.findByRole('link', { name: 'Back to all modules' })).toHaveAttribute('href', '/review')
  })

  it('has no serious accessibility problems', async () => {
    show({ modules: { data: [DETAIL] } })
    const { container } = openModule()
    await screen.findByRole('heading', { level: 2, name: 'Variables and Loops' })
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 5 })[0]).toHaveTextContent('Concept: Variables'))
    await expectNoSeriousA11yViolations(container)
  })
})

describe('demo mode', () => {
  it('explains that a database is needed and makes no database calls', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')
    const sb = show({ modules: { data: LIST } })
    openList()
    expect(screen.getByRole('status')).toHaveTextContent(/Demo mode/)
    expect(sb.from).not.toHaveBeenCalled()
  })
})
