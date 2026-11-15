// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from '../AdminPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => {
  class ModuleProblems extends Error {
    problems: string[]
    constructor(problems: string[]) { super('x'); this.problems = problems }
  }
  return {
    api: {
      listSubmitted: vi.fn(), listPublished: vi.fn(), publishModule: vi.fn(), sendBack: vi.fn(), listInvites: vi.fn(), listStaff: vi.fn(), setRole: vi.fn(),
      ModuleProblems,
      STAFF_ROLES: ['instructor', 'mentor', 'reviewer', 'cic_admin'],
      ROLE_LABEL: { instructor: 'Instructor', mentor: 'Mentor', reviewer: 'Reviewer', cic_admin: 'CIC admin' },
    },
    me: { data: { role: 'cic_admin', profile_id: 'me-id' } as { role: string; profile_id: string }, isPending: false },
  }
})
vi.mock('../api', () => m.api)
vi.mock('@/lib/session', () => ({ useMe: () => m.me, isDemoMode: () => false }))

const sub = (over: object = {}) => ({ id: 'm1', title: 'Loops', version: 2, created_at: '2026-11-14T20:00:00Z', published_at: null, profiles: { display_name: 'Ana Author' }, ...over })
const staff = [
  { id: 'me-id', display_name: 'Me Admin', role: 'cic_admin', can_author: true },
  { id: 'p2', display_name: 'Ivy Instructor', role: 'instructor', can_author: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  m.me.data = { role: 'cic_admin', profile_id: 'me-id' }
  m.api.listSubmitted.mockResolvedValue([sub()])
  m.api.listPublished.mockResolvedValue([sub({ id: 'm0', title: 'Basics', version: 1, published_at: '2026-11-13T20:00:00Z' })])
  m.api.listInvites.mockResolvedValue([])
  m.api.listStaff.mockResolvedValue(staff)
})

describe('admin access', () => {
  it('turns everyone else away', () => {
    m.me.data = { role: 'instructor', profile_id: 'x' }
    renderAt(<AdminPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('This page is for CIC admins.')
    expect(m.api.listSubmitted).not.toHaveBeenCalled()
  })

  it('opens on the publish queue, with a tab link per section', async () => {
    const { router } = renderAt(<AdminPage />)
    expect(await screen.findByRole('heading', { name: 'Waiting for review' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/publish')
    expect(screen.getByRole('link', { name: 'Staff' })).toHaveAttribute('href', '/admin/staff')
  })
})

describe('publish queue', () => {
  it('lists submitted modules with author and what is published, and has no serious axe violations', async () => {
    const { container } = renderAt(<AdminPage />, { url: '/admin/publish' })
    const row = (await screen.findByRole('row', { name: /Loops/ }))
    expect(within(row).getByText('Ana Author')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Preview Loops, version 2' })).toHaveAttribute('href', '/author/m1')
    expect(screen.getByRole('row', { name: /Basics/ })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('asks before publishing, and publishes only on confirm', async () => {
    m.api.publishModule.mockResolvedValue(null)
    renderAt(<AdminPage />, { url: '/admin/publish' })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish Loops, version 2' }))
    const dialog = screen.getByRole('dialog', { name: 'Publish Loops?' })
    expect(within(dialog).getByText("Published versions can't be edited. Classes stay on the version they started.")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(m.api.publishModule).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Publish Loops, version 2' }))
    m.api.listSubmitted.mockResolvedValue([])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }))
    expect(m.api.publishModule).toHaveBeenCalledWith('m1')
    expect(await screen.findByText(/Nothing is waiting/)).toBeInTheDocument()
  })

  it('shows what blocks publishing, and sends a module back', async () => {
    m.api.publishModule.mockRejectedValue(new m.api.ModuleProblems(['"Check", question "q1": has no answer key']))
    m.api.sendBack.mockResolvedValue(null)
    renderAt(<AdminPage />, { url: '/admin/publish' })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish Loops, version 2' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('"Check", question "q1": has no answer key')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Send back Loops, version 2' }))
    expect(m.api.sendBack).toHaveBeenCalledWith('m1')
  })

  it('has empty and error states', async () => {
    m.api.listSubmitted.mockResolvedValueOnce([]).mockResolvedValue([sub()])
    m.api.listPublished.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([])
    renderAt(<AdminPage />, { url: '/admin/publish' })
    expect(await screen.findByText(/Nothing is waiting/)).toBeInTheDocument()
    expect(await screen.findByText(/We could not load published modules/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No published modules yet.')).toBeInTheDocument()
  })
})

describe('staff', () => {
  it('shows invitations as Joined or waiting, and points to the invite form on Overview', async () => {
    m.api.listInvites.mockResolvedValue([
      { email: 'a@x.org', role: 'instructor', can_author: true, created_at: '2026-11-14T00:00:00Z', accepted_at: '2026-11-14T01:00:00Z' },
      { email: 'b@x.org', role: 'reviewer', can_author: false, created_at: '2026-11-14T00:00:00Z', accepted_at: null },
    ])
    const { container } = renderAt(<AdminPage />, { url: '/admin/staff' })
    expect(within(await screen.findByRole('row', { name: /a@x.org/ })).getByText('Joined')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /b@x.org/ })).getByText('Waiting for first sign-in')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Overview' })).toHaveLength(2) // the tab and the pointer in the text
    await expectNoSeriousA11yViolations(container)
  })

  it('changes a role or the author switch with the right arguments, and locks your own row', async () => {
    m.api.setRole.mockResolvedValue(null)
    renderAt(<AdminPage />, { url: '/admin/staff' })
    const own = await screen.findByRole('row', { name: /Me Admin/ })
    expect(within(own).getByRole('combobox')).toBeDisabled()
    expect(within(own).getByText("You can't change your own role.")).toBeInTheDocument()
    const ivy = screen.getByRole('row', { name: /Ivy Instructor/ })
    await userEvent.click(within(ivy).getByRole('checkbox'))
    expect(m.api.setRole).toHaveBeenCalledWith('p2', 'instructor', true)
    await userEvent.selectOptions(within(ivy).getByRole('combobox'), 'mentor')
    expect(m.api.setRole).toHaveBeenLastCalledWith('p2', 'mentor', false)
  })

  it('shows an error and a retry when staff will not load', async () => {
    m.api.listStaff.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    renderAt(<AdminPage />, { url: '/admin/staff' })
    expect(await screen.findByText(/We could not load staff/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No staff yet/)).toBeInTheDocument()
  })
})
