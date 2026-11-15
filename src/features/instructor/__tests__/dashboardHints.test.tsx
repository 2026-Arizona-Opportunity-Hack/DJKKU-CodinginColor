// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_A, renderAt } from '../test/harness'
import { InstructorDashboard } from '../InstructorDashboard'

const STUDENT = '40000000-0000-4000-8000-000000000001'
const m = vi.hoisted(() => ({ listInstructorClasses: vi.fn() }))
vi.mock('../api.supabase', () => ({ listInstructorClasses: m.listInstructorClasses, isInstructorDatabaseConfigured: () => true }))
vi.mock('../dashboardApi.supabase', () => ({
  isDashboardDatabaseConfigured: () => true,
  loadInstructorDashboard: async () => ({
    progress: [{ class_id: CLASS_A.id, student_id: STUDENT, display_name: 'Sam P.', required_activities: 7, completed_activities: 2, completion_pct: 28.57, last_active_at: null, joined: true }],
    notStarted: [], mastery: [], reteach: [], learningGain: [],
    stuck: [{ class_id: CLASS_A.id, student_id: STUDENT, activity_id: null, wrong_attempts: 3, minutes_on_activity: 4, hints_used: 2, days_inactive: 0, reasons: ['wrong_attempts'] }],
  }),
}))

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
  m.listInstructorClasses.mockResolvedValue([CLASS_A])
})

describe('stuck list', () => {
  it('shows how many hints a stuck student has used', async () => {
    renderAt(<InstructorDashboard />)
    expect(await screen.findByText('Sam P.')).toBeInTheDocument()
    expect(screen.getByText('3 wrong attempts')).toBeInTheDocument()
    expect(screen.getByText('Hints used: 2')).toBeInTheDocument()
  })
})
