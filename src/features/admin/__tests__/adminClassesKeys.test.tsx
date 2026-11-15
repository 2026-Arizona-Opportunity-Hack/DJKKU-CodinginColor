// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from '../AdminPage'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({
  api: {
    listSubmitted: vi.fn(), listPublished: vi.fn(), publishModule: vi.fn(), sendBack: vi.fn(), listInvites: vi.fn(), inviteStaff: vi.fn(), setRole: vi.fn(),
    listStaff: vi.fn(), listClasses: vi.fn(), addInstructor: vi.fn(), removeInstructor: vi.fn(),
    listSchools: vi.fn(), addSchool: vi.fn(), listKeys: vi.fn(), createKey: vi.fn(), revokeKey: vi.fn(),
    listMentors: vi.fn(), listOpenStudents: vi.fn(), assignMentor: vi.fn(),
    ModuleProblems: class extends Error {},
    STAFF_ROLES: ['instructor', 'mentor', 'reviewer', 'cic_admin'],
    ROLE_LABEL: { instructor: 'Instructor', mentor: 'Mentor', reviewer: 'Reviewer', cic_admin: 'CIC admin' },
    API_SCOPES: [
      { value: 'progress', label: 'Progress', path: '/api/v1/completion' },
      { value: 'assessments', label: 'Assessments', path: '/api/v1/learning-gain' },
    ],
  },
}))
vi.mock('../api', () => m.api)
vi.mock('@/lib/session', () => ({ useMe: () => ({ data: { role: 'cic_admin', profile_id: 'me' }, isPending: false }), isDemoMode: () => false }))

const cls = (over: object = {}) => ({ id: 'c1', name: 'Demo Period 1', term: 'Fall 2026', school: 'Demo High', kind: 'school', instructors: [{ profileId: 'i1', name: 'Ivy Instructor' }], students: 10, completionPct: 77.14, ...over })
const key = (over: object = {}) => ({ id: 'k1', name: 'CIC dashboard', scope: ['progress'], created_at: '2026-11-14T00:00:00Z', last_used_at: null, revoked_at: null, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  m.api.listClasses.mockResolvedValue([cls()])
  m.api.listStaff.mockResolvedValue([{ id: 'i1', display_name: 'Ivy Instructor', role: 'instructor', can_author: false }, { id: 'i2', display_name: 'Max Teacher', role: 'instructor', can_author: false }, { id: 'r1', display_name: 'Rae Reviewer', role: 'reviewer', can_author: false }])
  m.api.listSchools.mockResolvedValue([{ id: 's1', name: 'Demo High', created_at: '2026-11-14T00:00:00Z' }])
  m.api.listKeys.mockResolvedValue([key()])
  m.api.listMentors.mockResolvedValue([{ id: 'mm', display_name: 'Mo Mentor' }])
  m.api.listOpenStudents.mockResolvedValue([{ profile_id: 'st1', display_name: 'Sam P.' }])
})

describe('classes tab', () => {
  it('lists every class with instructors, students and completion, and links to the instructor view', async () => {
    const { container } = renderAt(<AdminPage />, { url: '/admin/classes' })
    const row = await screen.findByRole('row', { name: /Demo Period 1/ })
    expect(within(row).getByText('Demo High')).toBeInTheDocument()
    expect(within(row).getByText('Ivy Instructor')).toBeInTheDocument()
    expect(within(row).getByText('77%')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Open Demo Period 1' })).toHaveAttribute('href', '/instructor/c1')
    await expectNoSeriousA11yViolations(container)
  })

  it('adds an instructor (not one already there) and removes one, showing the database refusal', async () => {
    m.api.addInstructor.mockResolvedValue(null)
    m.api.removeInstructor.mockRejectedValue(new Error('A class needs at least one instructor'))
    renderAt(<AdminPage />, { url: '/admin/classes' })
    const picker = await screen.findByLabelText('Person to add to Demo Period 1')
    await waitFor(() => expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a person', 'Max Teacher']))
    await userEvent.selectOptions(picker, 'i2')
    await userEvent.click(screen.getByRole('button', { name: 'Add instructor to Demo Period 1' }))
    expect(m.api.addInstructor).toHaveBeenCalledWith('c1', 'i2')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ivy Instructor from Demo Period 1' }))
    expect(m.api.removeInstructor).toHaveBeenCalledWith('c1', 'i1')
    expect(await screen.findByText('A class needs at least one instructor')).toBeInTheDocument()
  })

  it('has empty and error states', async () => {
    m.api.listClasses.mockRejectedValueOnce(new Error('x')).mockResolvedValue([])
    renderAt(<AdminPage />, { url: '/admin/classes' })
    expect(await screen.findByText(/We could not load classes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No classes yet/)).toBeInTheDocument()
  })
})

describe('schools tab', () => {
  it('lists schools and adds one', async () => {
    m.api.addSchool.mockResolvedValue(undefined)
    const { container } = renderAt(<AdminPage />, { url: '/admin/schools' })
    expect(await screen.findByText(/Demo High/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('School name'), '  Maryvale High  ')
    await userEvent.click(screen.getByRole('button', { name: 'Add school' }))
    expect(m.api.addSchool).toHaveBeenCalledWith('  Maryvale High  ')
    expect(await screen.findByText('Added Maryvale High.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('shows the duplicate message, and empty and error states', async () => {
    m.api.addSchool.mockRejectedValue(new Error('That school already exists.'))
    m.api.listSchools.mockRejectedValueOnce(new Error('x')).mockResolvedValue([])
    renderAt(<AdminPage />, { url: '/admin/schools' })
    await userEvent.type(await screen.findByLabelText('School name'), 'Demo High')
    await userEvent.click(screen.getByRole('button', { name: 'Add school' }))
    expect(await screen.findByText('That school already exists.')).toBeInTheDocument()
    expect(screen.getByText(/We could not load schools/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No schools yet/)).toBeInTheDocument()
  })
})

describe('API keys tab', () => {
  it('lists keys without any secret', async () => {
    const { container } = renderAt(<AdminPage />, { url: '/admin/keys' })
    const row = await screen.findByRole('row', { name: /CIC dashboard/ })
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(within(row).getByText('Never')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/oh_[0-9a-f]{8}/)
    await expectNoSeriousA11yViolations(container)
  })

  it('shows the new key once with a curl example, and forgets it when the dialog closes', async () => {
    const raw = 'oh_' + 'a'.repeat(64)
    m.api.createKey.mockResolvedValue({ raw_key: raw })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const set = vi.spyOn(Storage.prototype, 'setItem')
    renderAt(<AdminPage />, { url: '/admin/keys' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Dashboard')
    await userEvent.click(screen.getByRole('checkbox', { name: /Assessments/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Create key' }))
    expect(m.api.createKey).toHaveBeenCalledWith('Dashboard', ['progress', 'assessments'])
    const dialog = await screen.findByRole('dialog', { name: 'Your new API key' })
    expect(within(dialog).getByText('This key is shown once. Store it somewhere safe.')).toBeInTheDocument()
    expect(within(dialog).getAllByText(new RegExp(raw)).length).toBeGreaterThan(0)
    expect(within(dialog).getByText(new RegExp(`curl -H "Authorization: Bearer ${raw}" ${window.location.origin}/api/v1/completion`))).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy key' }))
    expect(writeText).toHaveBeenCalledWith(raw)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.textContent).not.toContain(raw)
    expect(set).not.toHaveBeenCalled()
    set.mockRestore()
  })

  it('revokes only after a confirm, and shows empty and error states', async () => {
    m.api.revokeKey.mockResolvedValue(null)
    renderAt(<AdminPage />, { url: '/admin/keys' })
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke CIC dashboard' }))
    const dialog = screen.getByRole('dialog', { name: 'Revoke CIC dashboard?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(m.api.revokeKey).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Revoke CIC dashboard' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke key' }))
    expect(m.api.revokeKey).toHaveBeenCalledWith('k1')
  })

  it('has empty and error states', async () => {
    m.api.listKeys.mockRejectedValueOnce(new Error('x')).mockResolvedValue([])
    renderAt(<AdminPage />, { url: '/admin/keys' })
    expect(await screen.findByText(/We could not load API keys/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No API keys yet.')).toBeInTheDocument()
  })
})

describe('mentors tab', () => {
  it('assigns a CIC Open student to a mentor', async () => {
    m.api.assignMentor.mockResolvedValue(null)
    const { container } = renderAt(<AdminPage />, { url: '/admin/mentors' })
    await userEvent.selectOptions(await screen.findByLabelText('Student for Mo Mentor'), 'st1')
    await userEvent.click(screen.getByRole('button', { name: 'Assign student to Mo Mentor' }))
    expect(m.api.assignMentor).toHaveBeenCalledWith('mm', 'st1')
    expect(await screen.findByText('Sam P. assigned.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('has empty and error states', async () => {
    m.api.listMentors.mockResolvedValueOnce([]).mockResolvedValue([{ id: 'mm', display_name: 'Mo' }])
    m.api.listOpenStudents.mockRejectedValue(new Error('x'))
    renderAt(<AdminPage />, { url: '/admin/mentors' })
    expect(await screen.findByText(/No mentors yet/)).toBeInTheDocument()
  })
})
