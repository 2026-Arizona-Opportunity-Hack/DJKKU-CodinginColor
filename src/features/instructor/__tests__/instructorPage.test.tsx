// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_A, CLASS_B, expectNoSeriousA11yViolations, renderAt } from '../test/harness'
import { InstructorPage } from '../InstructorPage'

const m = vi.hoisted(() => ({ listInstructorClasses: vi.fn() }))
vi.mock('../api.supabase', () => ({ listInstructorClasses: m.listInstructorClasses, importRoster: vi.fn(), isInstructorDatabaseConfigured: () => true }))
vi.mock('../dashboardApi.supabase', () => ({
  isDashboardDatabaseConfigured: () => true,
  loadInstructorDashboard: async () => ({ progress: [], notStarted: [], stuck: [], mastery: [], reteach: [], learningGain: [] }),
}))
vi.mock('../setupApi', () => ({ listPublishedModules: async () => [], listClassModules: async () => [], createClass: vi.fn(), createJoinCode: vi.fn(), assignModule: vi.fn() }))
vi.mock('@/lib/session', async (orig) => ({ ...(await orig<typeof import('@/lib/session')>()), useMe: () => ({ data: { role: 'instructor' } }) }))

const open = (url: string) => renderAt(<InstructorPage />, { path: '/instructor/*', url })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  m.listInstructorClasses.mockResolvedValue([CLASS_A, CLASS_B])
})

describe('instructor home', () => {
  it('opens your first class by name from /instructor', async () => {
    open('/instructor')
    expect(await screen.findByRole('heading', { level: 2, name: 'Afterschool' })).toBeInTheDocument()
    expect(screen.getByLabelText('Class')).toHaveValue(CLASS_B.id)
  })

  it('shows every setup section for the class in the URL, with one h1 and no serious axe violations', async () => {
    const { container } = open(`/instructor/${CLASS_A.id}`)
    expect(await screen.findByRole('heading', { level: 2, name: 'Period 1' })).toBeInTheDocument()
    for (const name of ['Class link', 'Import student roster', 'Modules']) expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await screen.findByText('No modules assigned yet.')
    await expectNoSeriousA11yViolations(container)
  })

  it('offers the create form when you teach no classes yet', async () => {
    m.listInstructorClasses.mockResolvedValue([])
    open('/instructor')
    expect(await screen.findByRole('heading', { name: 'Create a class' })).toBeInTheDocument()
    expect(screen.getByText(/You don't teach any classes yet/)).toBeInTheDocument()
  })

  it('says so when the class in the URL is not one of yours', async () => {
    open('/instructor/20000000-0000-4000-8000-0000000000ff')
    expect(await screen.findByText(/We couldn't find that class/)).toBeInTheDocument()
  })

  it('says Demo mode, not an empty page, when no database is connected', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    open('/instructor')
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument()
  })
})
