// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '../OverviewTab'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({ listProfiles: vi.fn(), listClasses: vi.fn(), listSchools: vi.fn(), inviteStaff: vi.fn(), addClassInstructor: vi.fn() }))
vi.mock('../api.supabase', () => m)
vi.mock('@/lib/session', () => ({ isDemoMode: () => false }))

beforeEach(() => {
  vi.clearAllMocks()
  m.listProfiles.mockResolvedValue([{ id: 'i1', display_name: 'Ivy Instructor', role: 'instructor', can_author: false }, { id: 's1', display_name: 'Stu', role: 'student', can_author: false }])
  m.listClasses.mockResolvedValue([{ id: 'c1', name: 'Demo Period 1', term: 'Fall 2026', school_id: 'sc1' }])
  m.listSchools.mockResolvedValue([{ id: 'sc1', name: 'Demo High' }])
})

describe('overview tab (organization overview, invite, class staffing)', () => {
  it('shows the counts and class table, and has no serious axe violations', async () => {
    const { container } = renderAt(<OverviewTab />)
    expect(await screen.findByText('Organization overview')).toBeInTheDocument()
    expect(screen.getByText('Partner schools').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Staff accounts').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('cell', { name: 'Demo High' })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('invites staff and assigns an instructor with the right arguments', async () => {
    m.inviteStaff.mockResolvedValue(undefined)
    m.addClassInstructor.mockResolvedValue(undefined)
    renderAt(<OverviewTab />)
    await userEvent.type(await screen.findByLabelText('Email'), 'New@School.org')
    await userEvent.click(screen.getByRole('button', { name: 'Invite staff' }))
    expect(m.inviteStaff).toHaveBeenCalledWith('New@School.org', 'instructor', false)
    await userEvent.click(screen.getByRole('button', { name: 'Assign instructor' }))
    expect(m.addClassInstructor).toHaveBeenCalledWith('c1', 'i1')
    expect(await screen.findByText('Ivy Instructor added to Demo Period 1.')).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    m.listSchools.mockRejectedValue(new Error('offline'))
    renderAt(<OverviewTab />)
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})
