// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromDraftRows, type DraftPayload, type DraftRows } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

/** Types short or special-key text, and pastes plain text (much faster than one key at a time). */
async function typeIn(el: HTMLElement, text: string) {
  if (text.includes('{')) return userEvent.type(el, text)
  await userEvent.click(el)
  await userEvent.paste(text)
}


const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
}))
vi.mock('../api', () => m)
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', can_author: false }, isPending: false }), isDemoMode: () => false }))

const ID = '30000000-0000-4000-8000-000000000001'
const KEY_FIELDS = /correctChoiceId|accepted|blanks|correctOrder|hints|explanation|caseSensitive/

/** Turn a saved payload into the rows the database would return, then into what loadModule gives the editor. */
function reload(p: DraftPayload) {
  const rows: DraftRows = { module: { title: p.title, summary: p.summary, status: 'draft' }, lessons: [], activities: [], assessments: [], assessmentItems: [], activityKeys: {}, assessmentKeys: {} }
  p.lessons.forEach((l, li) => {
    rows.lessons.push({ id: `l${li}`, position: li, title: l.title })
    l.activities.forEach((a, ai) => {
      rows.activities.push({ id: `a${li}${ai}`, lesson_id: `l${li}`, position: ai, kind: a.kind, title: a.title, content: a.content, required: a.required, concept_id: a.concept_id })
      rows.activityKeys[`a${li}${ai}`] = a.keys
    })
  })
  return { ...fromDraftRows(rows), id: ID, slug: p.slug, version: 1, keysHidden: false }
}

const card = (n: number) => screen.getByRole('heading', { name: `Question ${n}` }).closest('li') as HTMLElement
async function addQuestion(type: string) {
  await userEvent.selectOptions(screen.getByLabelText('Question type'), type)
  await userEvent.click(screen.getByRole('button', { name: 'Add question' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  m.listConcepts.mockResolvedValue([{ id: 'loops', name: 'Loops' }, { id: 'variables', name: 'Variables' }])
  m.saveDraft.mockResolvedValue(ID)
})

describe('question editor', () => {
  it('writes every question type into the payload, keeps ids stable, and loads back into the same form', async () => {
    // After the first save the editor reopens the module from "the database": the last payload, reloaded.
    m.loadModule.mockImplementation(async () => reload(m.saveDraft.mock.calls.at(-1)![0]))
    const { router } = renderAt(<AuthoringPage />, { url: '/author/new' })
    await typeIn(await screen.findByLabelText('Module title'), 'Quiz')
    await typeIn(screen.getByLabelText('Lesson 1 title'), 'One')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'worksheet')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    await typeIn(screen.getByLabelText('Title'), 'Sheet')
    await userEvent.selectOptions(screen.getAllByLabelText('Concept')[0]!, 'loops') // the activity concept becomes the default for new questions

    // Multiple choice: three choices, reorder, pick the correct one, explanation and a hint.
    await addQuestion('mcq')
    let q = card(1)
    await typeIn(within(q).getByLabelText('Question text'), 'Which repeats?')
    await typeIn(within(q).getByLabelText('Choice 1'), 'A variable')
    await typeIn(within(q).getByLabelText('Choice 2'), 'A loop')
    await userEvent.click(within(q).getByRole('button', { name: 'Add choice' }))
    await typeIn(within(q).getByLabelText('Choice 3'), 'A print')
    await userEvent.click(within(q).getByRole('button', { name: 'Move choice 3 up' }))
    await userEvent.click(within(q).getByRole('radio', { name: 'Correct: choice 3' })) // "A loop" moved to third
    await typeIn(within(q).getByLabelText(/Explanation/), 'Loops repeat code.')
    await userEvent.click(within(q).getByRole('button', { name: 'Add hint' }))
    await typeIn(within(q).getByLabelText('Hint 1'), 'Think about repeating')

    await addQuestion('short_answer')
    q = card(2)
    await typeIn(within(q).getByLabelText('Question text'), 'Keyword for a loop?')
    await typeIn(within(q).getByLabelText('Accepted answers (one per line)'), 'while{Enter}for')
    await userEvent.click(within(q).getByRole('checkbox', { name: 'Case sensitive' }))

    await addQuestion('fill_blank')
    q = card(3)
    await typeIn(within(q).getByLabelText('Question text'), 'A ___ repeats, an ___ decides')
    expect(within(q).getByText(/This text has 2 blanks/)).toBeInTheDocument()
    await typeIn(within(q).getByLabelText('Accepted answers for blank 1 (one per line)'), 'loop')
    await typeIn(within(q).getByLabelText('Accepted answers for blank 2 (one per line)'), 'if')

    await addQuestion('ordering')
    q = card(4)
    await typeIn(within(q).getByLabelText('Question text'), 'Put in order')
    await typeIn(within(q).getByLabelText('Item 1'), 'Second')
    await typeIn(within(q).getByLabelText('Item 2'), 'First')
    await userEvent.click(within(q).getByRole('button', { name: 'Move item 2 up' }))

    await addQuestion('reflection')
    q = card(5)
    expect(within(q).getByText('Not scored')).toBeInTheDocument()
    expect(within(q).queryByLabelText(/Explanation/)).toBeNull()
    await typeIn(within(q).getByLabelText('Question text'), 'What was hard?')

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1), { timeout: 5000 })
    const first: DraftPayload = m.saveDraft.mock.calls[0]![0]
    const sheet = first.lessons[0]!.activities[0]!
    const qs = sheet.content.questions as { id: string; type: string; choices?: { id: string; text: string }[]; conceptId?: string }[]
    expect(qs.map((x) => x.type)).toEqual(['mcq', 'short_answer', 'fill_blank', 'ordering', 'reflection'])
    expect(qs.every((x) => /^q-[a-z0-9]{6}$/.test(x.id))).toBe(true)
    expect(qs[0]!.conceptId).toBe('loops')
    expect(JSON.stringify(sheet.content)).not.toMatch(KEY_FIELDS)
    const keyOf = (i: number) => sheet.keys.find((k) => k.question_id === qs[i]!.id)!.key as Record<string, unknown>
    const correct = qs[0]!.choices!.find((c) => c.text === 'A loop')!.id
    expect(keyOf(0)).toEqual({ type: 'mcq', correctChoiceId: correct, explanation: 'Loops repeat code.', hints: ['Think about repeating'] })
    expect(keyOf(1)).toMatchObject({ type: 'short_answer', accepted: ['while', 'for'], caseSensitive: true })
    expect(keyOf(2)).toMatchObject({ type: 'fill_blank', blanks: [['loop'], ['if']] })
    expect(keyOf(3)).toMatchObject({ type: 'ordering' })
    expect(sheet.keys.find((k) => k.question_id === qs[4]!.id)).toBeUndefined() // reflection has no key

    // Load what was saved back into the editor: the same form comes back and saves the same payload.
    await waitFor(() => expect(router.state.location.pathname).toBe(`/author/${ID}`), { timeout: 5000 })
    q = (await screen.findByRole('heading', { name: 'Question 1' }, { timeout: 5000 })).closest('li') as HTMLElement
    expect(within(q).getByLabelText('Choice 3')).toHaveValue('A loop')
    expect(within(q).getByRole('radio', { name: 'Correct: choice 3' })).toBeChecked()
    expect(within(card(4)).getByLabelText('Item 1')).toHaveValue('First') // author order, not the shuffled one
    expect(within(card(2)).getByLabelText('Accepted answers (one per line)')).toHaveValue('while\nfor')
    await typeIn(screen.getByLabelText('Module title'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(2), { timeout: 5000 })
    const second: DraftPayload = m.saveDraft.mock.calls[1]![0]
    expect(second.lessons).toEqual(first.lessons)
  }, 30000)

  it('explains what is missing next to the question, and does not save', async () => {
    renderAt(<AuthoringPage />, { url: '/author/new' })
    await typeIn(await screen.findByLabelText('Module title'), 'Quiz')
    await typeIn(screen.getByLabelText('Lesson 1 title'), 'One')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'check')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    await typeIn(screen.getByLabelText('Title'), 'Check')
    await addQuestion('mcq')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    const q = card(1)
    expect(await within(q).findByText('Write the question.')).toBeInTheDocument()
    expect(within(q).getByText('Pick a concept for this question.')).toBeInTheDocument()
    expect(within(q).getByText('Fill in every choice.')).toBeInTheDocument()
    expect(within(q).getByText('Pick the correct answer.')).toBeInTheDocument()
    expect(m.saveDraft).not.toHaveBeenCalled()
  })

  it('allows at most 3 questions in a check, and moves and deletes them', async () => {
    renderAt(<AuthoringPage />, { url: '/author/new' })
    await screen.findByLabelText('Module title')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'check')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    for (const t of ['mcq', 'short_answer', 'reflection']) await addQuestion(t)
    expect(screen.getByRole('button', { name: 'Add question' })).toBeDisabled()
    expect(screen.getByText('At most 3 questions here.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Move question 3 up' }))
    expect(within(card(2)).getByText('Reflection')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete question 1' }))
    expect(screen.queryByRole('heading', { name: 'Question 3' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add question' })).toBeEnabled()
  })

  it('previews as a student would see it, with no answer key anywhere', async () => {
    m.loadModule.mockResolvedValue({
      id: ID, slug: 's', version: 1, keysHidden: false, pre: null, post: null,
      module: { title: 'T', summary: '', status: 'draft', lessons: [{ title: 'L', activities: [
        { kind: 'check', title: 'Check', required: true, questions: [
          { content: { type: 'mcq', id: 'q1', prompt: 'Pick `x`', conceptId: 'loops', choices: [{ id: 'a', text: 'Right one' }, { id: 'b', text: 'Wrong one' }] },
            key: { type: 'mcq', correctChoiceId: 'a', explanation: 'SECRET-EXPLANATION', hints: ['SECRET-HINT'] } },
          { content: { type: 'ordering', id: 'q2', prompt: 'Order', conceptId: 'loops', items: [{ id: 'i1', text: 'One' }, { id: 'i2', text: 'Two' }, { id: 'i3', text: 'Three' }] },
            key: { type: 'ordering', correctOrder: ['i1', 'i2', 'i3'], hints: [] } },
        ] },
        { kind: 'video', title: 'Watch', required: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', transcript: 'Words' },
      ] }] },
    })
    const { container } = renderAt(<AuthoringPage />, { url: `/author/${ID}` })
    const [check, video] = (await screen.findAllByRole('button', { name: 'Preview as student' }))
    await userEvent.click(check!)
    const preview = screen.getByRole('region', { name: 'Student preview of Check' })
    expect(within(preview).getByText('Right one')).toBeInTheDocument()
    expect(within(preview).getByText('x').tagName).toBe('CODE')
    expect(preview.textContent).not.toMatch(/SECRET|Correct/)
    expect(within(preview).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    expect(within(preview).getAllByRole('listitem').map((li) => li.textContent).slice(-3)).not.toEqual(['One', 'Two', 'Three'])
    await userEvent.click(video!)
    expect(within(screen.getByRole('region', { name: 'Student preview of Watch' })).getByTitle('Video: Watch')).toHaveAttribute('src', expect.stringContaining('youtube-nocookie.com/embed/dQw4w9WgXcQ'))
    await expectNoSeriousA11yViolations(container)
  })
})
