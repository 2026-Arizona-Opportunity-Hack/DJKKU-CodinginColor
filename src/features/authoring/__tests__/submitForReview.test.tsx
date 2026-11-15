// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fixList } from '../api'
import { AuthoringPage } from '../AuthoringPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  listMyModules: vi.fn(), loadModule: vi.fn(), saveDraft: vi.fn(), newVersion: vi.fn(), listConcepts: vi.fn(), upsertConcept: vi.fn(), submitModule: vi.fn(),
}))
vi.mock('../api', async (orig) => ({
  fixList: (await orig<typeof import('../api')>()).fixList,
  listMyModules: m.listMyModules, loadModule: m.loadModule, saveDraft: m.saveDraft, newVersion: m.newVersion,
  listConcepts: m.listConcepts, upsertConcept: m.upsertConcept, submitModule: m.submitModule,
}))
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'instructor', can_author: true }, isPending: false }), isDemoMode: () => false }))

const ID = '30000000-0000-4000-8000-000000000002'
const module = (status: 'draft' | 'submitted') => ({
  id: ID, slug: 'variables-and-loops', version: 2, keysHidden: false, pre: null, post: null,
  module: { title: 'Variables and Loops', summary: '', status, lessons: [{ title: 'Loops', activities: [{ kind: 'reading', title: 'Intro', required: true, body: 'Hi' }] }] },
})
const open = (url = `/author/${ID}`) => renderAt(<AuthoringPage />, { url })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  m.listConcepts.mockResolvedValue([])
  m.loadModule.mockResolvedValue(module('draft'))
})

describe('submit for review', () => {
  it('asks first, submits the saved draft, then shows it locked with the notes for the reviewer', async () => {
    m.submitModule.mockResolvedValue({ warnings: ['This module has no pre or post test, so it will have no learning gain'] })
    const { container } = open()
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    const ask = screen.getByRole('group', { name: /Submit for review\? You can't edit it/ })
    expect(m.submitModule).not.toHaveBeenCalled()
    await expectNoSeriousA11yViolations(container)

    m.loadModule.mockResolvedValue(module('submitted'))
    await userEvent.click(within(ask).getByRole('button', { name: 'Yes, submit' }))
    expect(m.submitModule).toHaveBeenCalledWith(ID)
    const locked = (await screen.findByText(/Submitted for review. It is locked/)).parentElement!
    expect(locked).toHaveTextContent('This module has no pre or post test')
    await waitFor(() => expect(locked).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Module title')).toBeDisabled()
  })

  it('can be cancelled', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: /Submit for review\?/ })).not.toBeInTheDocument()
    expect(m.submitModule).not.toHaveBeenCalled()
  })

  it('asks to save unsaved changes first, so the admin never reviews an old copy', async () => {
    open()
    await userEvent.type(await screen.findByLabelText('Module title'), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText('Save your changes first, then submit.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Submit for review\?/ })).not.toBeInTheDocument()
    expect(m.submitModule).not.toHaveBeenCalled()
  })

  it("lists the database's reasons when it refuses, and stays editable", async () => {
    m.submitModule.mockRejectedValue(new Error('Fix these first: Lesson "Loops" has no activities; "Check", question "q1": needs a correct choice'))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, submit' }))
    const reasons = (await screen.findByText('Fix these first, then save and submit again:')).parentElement!
    expect(within(reasons).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Lesson "Loops" has no activities', '"Check", question "q1": needs a correct choice'])
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
  })

  it('is not offered before the module has been saved once', async () => {
    open('/author/new')
    await screen.findByRole('button', { name: 'Save draft' })
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument()
  })
})

describe('fixList', () => {
  it('splits the database message into items, and keeps any other message whole', () => {
    expect(fixList('Fix these first: a; b')).toEqual(['a', 'b'])
    expect(fixList('Only the owner of a draft can submit it')).toEqual(['Only the owner of a draft can submit it'])
  })
})
