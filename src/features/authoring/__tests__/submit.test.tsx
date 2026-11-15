// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredQuestion, DraftPayload } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

/** Types short or special-key text, and pastes plain text (much faster than one key at a time). */
async function typeIn(el: HTMLElement, text: string) {
  if (text.includes('{')) return userEvent.type(el, text)
  await userEvent.click(el)
  await userEvent.paste(text)
}


const m = vi.hoisted(() => {
  class ModuleProblems extends Error {
    problems: string[]
    constructor(problems: string[]) {
      super('Fix these first.')
      this.problems = problems
    }
  }
  return {
    api: {
      listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(),
      submitModule: vi.fn(), publishModule: vi.fn(), ModuleProblems,
    },
    me: { data: { role: 'instructor', can_author: true } as { role: string; can_author: boolean }, isPending: false },
  }
})
vi.mock('../api', () => m.api)
vi.mock('@/lib/session', () => ({ useMe: () => m.me, isDemoMode: () => false }))

const ID = '30000000-0000-4000-8000-000000000001'
const mcq = (id: string, conceptId = 'loops'): AuthoredQuestion => ({
  content: { type: 'mcq', id, prompt: `Question ${id}`, conceptId, choices: [{ id: 'a', text: 'Yes' }, { id: 'b', text: 'No' }] },
  key: { type: 'mcq', correctChoiceId: 'a', hints: [] },
})
const base = (over: object = {}) => ({
  id: ID, slug: 'loops', version: 1, keysHidden: false, pre: null, post: null,
  module: { title: 'Loops', summary: '', status: 'draft', lessons: [{ title: 'L', activities: [{ kind: 'check', title: 'Check', required: true, questions: [mcq('q1')] }] }] },
  ...over,
})
const open = () => renderAt(<AuthoringPage />, { url: `/author/${ID}` })
const sent = (n = 0): DraftPayload => m.api.saveDraft.mock.calls[n]![0]

beforeEach(() => {
  vi.clearAllMocks()
  m.me.data = { role: 'instructor', can_author: true }
  m.api.listConcepts.mockResolvedValue([{ id: 'loops', name: 'Loops' }])
  m.api.saveDraft.mockResolvedValue(ID)
})

describe('pre-test and post-test builder', () => {
  it('builds both tests, copies pre into post, warns about unpaired items, and saves them', async () => {
    m.api.loadModule.mockResolvedValue(base())
    const { container } = open()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a pre-test' }))
    expect(within(screen.getByLabelText('Item type')).queryByRole('option', { name: 'Reflection' })).toBeNull()
    await userEvent.selectOptions(screen.getByLabelText('Item type'), 'short_answer')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const items = () => screen.getAllByRole('heading', { name: /^Pre-test item/ }).map((h) => h.closest('li') as HTMLElement)
    expect(items().map((li) => (within(li).getByLabelText('Pair key') as HTMLInputElement).value)).toEqual(['p1', 'p2'])
    for (const [i, li] of items().entries()) {
      await typeIn(within(li).getByLabelText('Question text'), `What is ${i}?`)
      await typeIn(within(li).getByLabelText('Accepted answers (one per line)'), `${i}`)
      await userEvent.selectOptions(within(li).getByLabelText('Concept for this question'), 'loops')
    }
    expect(screen.getByText(/There is no post-test yet/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Post-test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy pre-test into post-test' }))
    const postItems = screen.getAllByRole('heading', { name: /^Post-test item/ }).map((h) => h.closest('li') as HTMLElement)
    expect(postItems).toHaveLength(2)
    const pair = within(postItems[1]!).getByLabelText('Pair key')
    await userEvent.clear(pair)
    await typeIn(pair, 'p9')
    const warnings = screen.getByRole('list', { name: 'Pairing warnings' })
    expect(warnings).toHaveTextContent('Pre item "p2" has no matching post item')
    expect(warnings).toHaveTextContent('Post item "p9" has no matching pre item')
    await expectNoSeriousA11yViolations(container)

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.api.saveDraft).toHaveBeenCalled())
    const [pre, post] = sent().assessments
    expect(pre).toMatchObject({ kind: 'pre', items: [{ pair_key: 'p1', concept_id: 'loops' }, { pair_key: 'p2' }] })
    expect(post!.items.map((i) => i.pair_key)).toEqual(['p1', 'p9'])
    expect(post!.items[0]!.question_id).not.toBe(pre!.items[0]!.question_id) // the copy got its own ids
    expect(post!.items[0]!.key).toEqual(pre!.items[0]!.key)
    expect(JSON.stringify(sent().assessments.map((a) => a.items.map((i) => i.content)))).not.toMatch(/accepted|hints/)
  }, 30000)

  it('loads saved tests back into the builder and saves them unchanged', async () => {
    const pre = { kind: 'pre', items: [{ pairKey: 'p1', question: mcq('pre-1') }] }
    const post = { kind: 'post', items: [{ pairKey: 'p1', question: mcq('post-1') }] }
    m.api.loadModule.mockResolvedValue(base({ pre, post }))
    open()
    await screen.findByRole('heading', { name: 'Pre-test item 1' })
    expect(screen.queryByRole('list', { name: 'Pairing warnings' })).toBeNull()
    await typeIn(screen.getByLabelText('Module title'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.api.saveDraft).toHaveBeenCalled())
    expect(sent().assessments.map((a) => [a.kind, a.items.map((i) => [i.pair_key, i.question_id])])).toEqual([['pre', [['p1', 'pre-1']]], ['post', [['p1', 'post-1']]]])
  })
})

describe('submit and publish', () => {
  it('saves, then submits; on success it says so and locks the editor', async () => {
    m.api.loadModule.mockResolvedValue(base())
    m.api.submitModule.mockResolvedValue({ errors: [], warnings: ['This module has no pre or post test, so it will have no learning gain'] })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByText('Submitted. A CIC admin will publish it.')).toBeInTheDocument()
    expect(m.api.saveDraft).toHaveBeenCalledTimes(1)
    expect(m.api.submitModule).toHaveBeenCalledWith(ID)
    expect(m.api.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(m.api.submitModule.mock.invocationCallOrder[0]!)
    expect(screen.getByText(/no learning gain/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(screen.getByLabelText('Module title')).toBeDisabled()
  })

  it('shows blocking problems at the top and next to the question, and stays a draft', async () => {
    m.api.loadModule.mockResolvedValue(base({ pre: { kind: 'pre', items: [{ pairKey: 'p1', question: mcq('pre-1') }] } }))
    m.api.submitModule.mockRejectedValue(new m.api.ModuleProblems(['"Check", question "q1": is missing a concept tag', 'pre-test item "p1": has no answer key']))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    const top = await screen.findByText('Fix these first. The module is still a draft.')
    expect(top.parentElement).toHaveTextContent('"Check", question "q1": is missing a concept tag')
    const q = screen.getByRole('heading', { name: 'Question 1' }).closest('li') as HTMLElement
    expect(within(q).getByText('is missing a concept tag')).toBeInTheDocument()
    const item = screen.getByRole('heading', { name: 'Pre-test item 1' }).closest('li') as HTMLElement
    expect(within(item).getByText('has no answer key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    expect(screen.queryByText(/Submitted\./)).toBeNull()
  })

  it('shows Publish now only to a CIC admin, and publishing freezes the module', async () => {
    m.api.loadModule.mockResolvedValue(base())
    const first = open()
    await screen.findByRole('button', { name: 'Submit for review' })
    expect(screen.queryByRole('button', { name: 'Publish now' })).toBeNull()
    first.unmount()

    m.me.data = { role: 'cic_admin', can_author: false }
    m.api.publishModule.mockResolvedValue({ errors: [], warnings: [] })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Publish now' }))
    expect(await screen.findByText('Published. Instructors can now assign it to a class.')).toBeInTheDocument()
    expect(m.api.publishModule).toHaveBeenCalledWith(ID)
    expect(screen.getByText(/published and cannot be changed/)).toBeInTheDocument()
  })

  it('lets an admin publish a submitted module from the read-only view', async () => {
    m.me.data = { role: 'cic_admin', can_author: false }
    m.api.loadModule.mockResolvedValue(base({ module: { ...base().module, status: 'submitted' } }))
    m.api.publishModule.mockResolvedValue({ errors: [], warnings: [] })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Publish now' }))
    expect(await screen.findByText(/^Published\./)).toBeInTheDocument()
    expect(m.api.saveDraft).not.toHaveBeenCalled() // a submitted module is locked; nothing to save
  })
})
