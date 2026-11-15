// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLASS_A, renderAt } from '../test/harness'
import { InstructorDashboard } from '../InstructorDashboard'

const JOINED = '40000000-0000-4000-8000-000000000001'
const SEAT_B = '20000000-0000-4000-8000-00000000000b'
const SEAT_C1 = '20000000-0000-4000-8000-0000000000c1'
const SEAT_C2 = '20000000-0000-4000-8000-0000000000c2'
const row = (student_id: string | null, display_name: string) => ({
  class_id: CLASS_A.id, student_id, display_name, required_activities: 7, completed_activities: 0, completion_pct: 0, last_active_at: null, joined: student_id !== null,
})

vi.mock('../api.supabase', () => ({ listInstructorClasses: async () => [CLASS_A], isInstructorDatabaseConfigured: () => true }))
vi.mock('../dashboardApi.supabase', () => ({
  isDashboardDatabaseConfigured: () => true,
  loadInstructorDashboard: async () => ({
    progress: [row(JOINED, 'Ava K.'), row(null, 'Test Student B.'), row(null, 'Sam P.'), row(null, 'Sam P.')],
    seats: [
      { id: 'seat-ava', profile_id: JOINED, display_name: 'Ava K.' },
      { id: SEAT_B, profile_id: null, display_name: 'Test Student B.' },
      { id: SEAT_C1, profile_id: null, display_name: 'Sam P.' },
      { id: SEAT_C2, profile_id: null, display_name: 'Sam P.' },
    ],
    notStarted: [], stuck: [], mastery: [], reteach: [], learningGain: [],
  }),
}))

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
})

describe('students who have not joined yet', () => {
  it('link to their page by seat id, so the instructor can reset their login code', async () => {
    renderAt(<InstructorDashboard />)
    const roster = await screen.findByRole('region', { name: 'Students' })
    expect(within(roster).getByRole('link', { name: 'Test Student B.' })).toHaveAttribute('href', `/instructor/${CLASS_A.id}/students/${SEAT_B}`)
    expect(within(roster).getByRole('link', { name: 'Ava K.' })).toHaveAttribute('href', `/instructor/${CLASS_A.id}/students/${JOINED}`)
  })

  it('gives two unclaimed students with the same name one seat each', async () => {
    renderAt(<InstructorDashboard />)
    const roster = await screen.findByRole('region', { name: 'Students' })
    const hrefs = within(roster).getAllByRole('link', { name: 'Sam P.' }).map((a) => a.getAttribute('href'))
    expect(hrefs.sort()).toEqual([`/instructor/${CLASS_A.id}/students/${SEAT_C1}`, `/instructor/${CLASS_A.id}/students/${SEAT_C2}`].sort())
  })
})
