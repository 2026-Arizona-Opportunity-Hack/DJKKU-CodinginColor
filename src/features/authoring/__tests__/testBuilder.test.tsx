// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DraftPayload } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
}))
vi.mock('../api', () => m)
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', can_author: false }, isPending: false }), isDemoMode: () => false }))

beforeEach(() => {
  vi.clearAllMocks()
  m.listConcepts.mockResolvedValue([{ id: 'loops', name: 'Loops' }])
  m.saveDraft.mockResolvedValue('30000000-0000-4000-8000-000000000001')
})

describe('pre-test and post-test builder', () => {
  it('builds a pre-test by hand, copies it into the post-test with the same pair keys, and saves both', async () => {
    const { container } = renderAt(<AuthoringPage />, { url: '/author/new' })
    await userEvent.type(await screen.findByLabelText('Module title'), 'Loops')
    await userEvent.type(screen.getByLabelText('Lesson 1 title'), 'L')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'reading')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    await userEvent.type(screen.getByLabelText('Title'), 'R')
    await userEvent.click(screen.getByLabelText('Reading (markdown)', { selector: 'textarea' }))
    await userEvent.paste('Loops repeat.')
    expect(screen.getByText(/has no pre-test or post-test yet/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add a pre-test by hand' }))
    await userEvent.selectOptions(screen.getByLabelText('Item type'), 'short_answer')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const item = screen.getByRole('heading', { name: 'Pre-test item 1' }).closest('li') as HTMLElement
    await userEvent.click(within(item).getByLabelText('Question text'))
    await userEvent.paste('Which keyword repeats while something is true?')
    await userEvent.click(within(item).getByLabelText('Accepted answers (one per line)'))
    await userEvent.paste('while')
    await userEvent.selectOptions(within(item).getByLabelText('Concept for this question'), 'loops')
    expect(screen.getByText(/There is no post-test yet/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Post-test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add a post-test by hand' }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy pre-test into post-test' }))
    expect(screen.getByRole('tab', { name: 'Post-test (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByLabelText('Pairing warnings')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1))
    const payload: DraftPayload = m.saveDraft.mock.calls[0]![0]
    expect(payload.assessments.map((a) => a.kind)).toEqual(['pre', 'post'])
    expect(payload.assessments.map((a) => a.items[0]!.pair_key)).toEqual(['p1', 'p1'])
    expect(payload.assessments[0]!.items[0]!.key).toMatchObject({ type: 'short_answer', accepted: ['while'] })
    expect(payload.assessments[0]!.items[0]!.question_id).not.toBe(payload.assessments[1]!.items[0]!.question_id)
    await expectNoSeriousA11yViolations(container)
  })
})

describe('tests on a published module', () => {
  it('explains that a published version is locked and makes a new version to add tests', async () => {
    const ID = '30000000-0000-4000-8000-000000000002'
    m.loadModule.mockResolvedValue({
      id: ID, slug: 'ai-roadmap', version: 1, keysHidden: false, pre: null, post: null,
      module: { title: 'AI roadmap', summary: '', status: 'published', lessons: [{ title: 'L', activities: [{ kind: 'reading', title: 'R', required: true, conceptId: 'loops', body: 'Text' }] }] },
    })
    m.newVersion.mockResolvedValue('30000000-0000-4000-8000-000000000003')
    const { router } = renderAt(<AuthoringPage />, { url: `/author/${ID}` })
    expect(await screen.findByText(/has no pre-test or post-test, so it shows no learning gain/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Draft both tests with AI' })).not.toBeInTheDocument()
    expect(screen.getByText(/A published version is locked so classes using it never change/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Make a new version to add tests' }))
    await waitFor(() => expect(m.newVersion).toHaveBeenCalledWith(ID))
    await waitFor(() => expect(router.state.location.pathname).toBe('/author/30000000-0000-4000-8000-000000000003'))
  })
})
