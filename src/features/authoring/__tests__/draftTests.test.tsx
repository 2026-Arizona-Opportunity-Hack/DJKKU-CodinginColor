// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toAssessments, type DraftTestsRequest } from '@shared/authoring/draftTests'
import type { DraftPayload } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
}))
vi.mock('../api', () => m)
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', can_author: false }, isPending: false }), isDemoMode: () => false }))
const draft = vi.hoisted(() => ({ draftTests: vi.fn() }))
vi.mock('../draftTestsApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../draftTestsApi')>()), draftTests: draft.draftTests }))

const pair = (n: number) => ({
  concept: 'loops',
  pre: { type: 'mcq', prompt: `How many times does \`for i in range(${n}):\` run?`, choices: [String(n), String(n - 1), String(n + 1), '0'], answer: 0 },
  post: { type: 'mcq', prompt: `How many numbers does \`range(${n + 2})\` give?`, choices: [String(n + 2), String(n + 1), String(n + 3), '1'], answer: 0 },
})

beforeEach(() => {
  vi.clearAllMocks()
  m.listConcepts.mockResolvedValue([{ id: 'loops', name: 'Loops' }, { id: 'variables', name: 'Variables' }])
  m.saveDraft.mockResolvedValue('30000000-0000-4000-8000-000000000001')
  draft.draftTests.mockImplementation(async (request: DraftTestsRequest) => ({ ...toAssessments({ pairs: [pair(3), pair(4), pair(5)] }, request), usedTranscripts: 1 }))
})

describe('drafting the pre-test and post-test with AI', () => {
  it('sends the module material, fills both tests with paired items, and saves them with their keys', async () => {
    const { container } = renderAt(<AuthoringPage />, { url: '/author/new' })
    await userEvent.type(await screen.findByLabelText('Module title'), 'Loops from a video')
    await userEvent.type(screen.getByLabelText('Lesson 1 title'), 'Loops')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'reading')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Repeating')
    await userEvent.click(screen.getByLabelText('Reading (markdown)', { selector: 'textarea' }))
    await userEvent.paste('A for loop repeats a block. range(3) gives 0, 1, 2.')

    expect(screen.getByText(/has no pre-test or post-test yet/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Pairs of questions'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Draft both tests with AI' }))

    expect(await screen.findByText(/Drafted 3 paired items \(read 1 video transcript\)\. Read every question/)).toBeInTheDocument()
    const sent = draft.draftTests.mock.calls[0]![0] as DraftTestsRequest
    expect(sent).toMatchObject({ title: 'Loops from a video', pairs: 3, concepts: [{ id: 'loops' }, { id: 'variables' }] })
    expect(sent.lessons[0]!.activities[0]).toMatchObject({ kind: 'reading', title: 'Repeating', text: 'A for loop repeats a block. range(3) gives 0, 1, 2.' })

    expect(screen.getByRole('tab', { name: 'Pre-test (3)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Post-test (3)' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Pairing warnings')).not.toBeInTheDocument() // every item has its twin
    const panel = screen.getByRole('tabpanel', { name: 'Pre-test (3)' })
    expect(within(panel).getByRole('heading', { name: 'Pre-test item 1' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1))
    const payload: DraftPayload = m.saveDraft.mock.calls[0]![0]
    const pre = payload.assessments.find((a) => a.kind === 'pre')!
    const post = payload.assessments.find((a) => a.kind === 'post')!
    expect(pre.items.map((i) => i.pair_key)).toEqual(['p1', 'p2', 'p3'])
    expect(post.items.map((i) => i.pair_key)).toEqual(['p1', 'p2', 'p3'])
    expect(pre.items[0]!.key).toMatchObject({ type: 'mcq', correctChoiceId: expect.any(String) })
    expect(JSON.stringify(pre.items.map((i) => i.content))).not.toMatch(/correctChoiceId/)
    await expectNoSeriousA11yViolations(container)
  })

  it('asks before replacing tests that already have items, and shows a clear error when drafting fails', async () => {
    draft.draftTests.mockRejectedValueOnce(new Error('AI drafting is not set up on this site yet. Write the tests by hand, or ask the site admin.'))
    renderAt(<AuthoringPage />, { url: '/author/new' })
    await userEvent.type(await screen.findByLabelText('Module title'), 'M')
    await userEvent.click(screen.getByRole('button', { name: 'Draft both tests with AI' }))
    expect(await screen.findByText(/AI drafting is not set up on this site yet/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Draft both tests with AI' }))
    await screen.findByRole('tab', { name: 'Pre-test (3)' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getByRole('button', { name: 'Draft both tests with AI' }))
    expect(confirm).toHaveBeenCalledWith('Replace the current pre-test and post-test with an AI draft?')
    expect(draft.draftTests).toHaveBeenCalledTimes(2)
  })
})
