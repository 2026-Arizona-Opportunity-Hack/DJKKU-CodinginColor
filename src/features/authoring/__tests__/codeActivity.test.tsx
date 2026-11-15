// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DraftPayload } from '@shared/authoring/schemas'
import { AuthoringPage } from '../AuthoringPage'
import { renderAt } from '../test/harness'

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

describe('code activity in the studio', () => {
  it('authors task, predict question, starter code and checks, previews them, and saves them as content', async () => {
    renderAt(<AuthoringPage />, { url: '/author/new' })
    await userEvent.type(await screen.findByLabelText('Module title'), 'Code')
    await userEvent.type(screen.getByLabelText('Lesson 1 title'), 'Loops')
    await userEvent.selectOptions(screen.getByLabelText('Activity type'), 'code')
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Count to ten')
    await userEvent.type(screen.getByLabelText('Task for the student (markdown)', { selector: 'textarea' }), 'Make total 55.')
    await userEvent.type(screen.getByLabelText(/Predict question/), 'What prints?')
    await userEvent.type(screen.getByLabelText('Starter code (Python)'), 'total = 0')
    await userEvent.type(screen.getByLabelText(/Checks, one per line/), 'assert total == 55{Enter}assert total > 0')

    await userEvent.click(screen.getByRole('button', { name: 'Preview as student' }))
    expect(screen.getByText('Checks the student must pass (2)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalledTimes(1))
    const payload: DraftPayload = m.saveDraft.mock.calls[0]![0]
    expect(payload.lessons[0]!.activities[0]).toMatchObject({
      kind: 'code',
      keys: [],
      content: { prompt: 'Make total 55.', starter: 'total = 0', predict: 'What prints?', tests: ['assert total == 55', 'assert total > 0'] },
    })
  })
})
