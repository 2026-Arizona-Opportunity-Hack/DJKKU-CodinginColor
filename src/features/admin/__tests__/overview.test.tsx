// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewTab } from '../OverviewTab'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'

const m = vi.hoisted(() => ({ listProfiles: vi.fn(), listClasses: vi.fn(), listSchools: vi.fn(), inviteStaff: vi.fn(), addClassInstructor: vi.fn(), listClassInstructors: vi.fn() }))
vi.mock('../api.supabase', () => m)
vi.mock('@/lib/session', () => ({ isDemoMode: () => false }))

beforeEach(() => {
  vi.clearAllMocks()
  m.listProfiles.mockResolvedValue([{ id: 'i1', display_name: 'Ivy Instructor', role: 'instructor', can_author: false }, { id: 's1', display_name: 'Stu', role: 'student', can_author: false }])
  m.listClasses.mockResolvedValue([{ id: 'c1', name: 'Demo Period 1', term: 'Fall 2026', school_id: 'sc1' }])
  m.listSchools.mockResolvedValue([{ id: 'sc1', name: 'Demo High' }])
  m.listClassInstructors.mockResolvedValue([])
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
    // The class table updates without a reload.
    expect(within(screen.getByRole('row', { name: /Demo Period 1/ })).getByText('Ivy Instructor')).toBeInTheDocument()
  })

  it('lists who teaches each class, and flags a class with no instructor', async () => {
    m.listProfiles.mockResolvedValue([
      { id: 'i1', display_name: 'Ivy Instructor', role: 'instructor', can_author: false },
      { id: 'a1', display_name: 'Ana Admin', role: 'cic_admin', can_author: true },
    ])
    m.listClasses.mockResolvedValue([
      { id: 'c1', name: 'Demo Period 1', term: 'Fall 2026', school_id: 'sc1' },
      { id: 'c2', name: 'Demo Period 3', term: 'Fall 2026', school_id: 'sc1' },
    ])
    m.listClassInstructors.mockResolvedValue([{ class_id: 'c1', profile_id: 'i1' }, { class_id: 'c1', profile_id: 'a1' }])
    renderAt(<OverviewTab />)
    const table = await screen.findByRole('table', { name: 'Classes, their school, term and instructors' })
    expect(within(table).getByRole('row', { name: /Demo Period 1/ })).toHaveTextContent('Ana Admin, Ivy Instructor')
    expect(within(table).getByRole('row', { name: /Demo Period 3/ })).toHaveTextContent('No instructor')
  })

  it('shows a load error', async () => {
    m.listSchools.mockRejectedValue(new Error('offline'))
    renderAt(<OverviewTab />)
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})
