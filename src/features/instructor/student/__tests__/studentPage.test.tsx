// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionError } from '@/lib/session'
import { expectNoSeriousA11yViolations, renderAt } from '../../test/harness'
import { DEMO_STUDENT_ID, demoReportInput } from '../demoReport'
import { reportCsv } from '../exportCsv'
import { buildStudentReport } from '../report'
import { StudentPage } from '../StudentPage'

const CLASS = '10000000-0000-4000-8000-00000000000a'
const SEAT = '20000000-0000-4000-8000-000000000001'
const NOW = new Date(2026, 10, 15, 12)

const h = vi.hoisted(() => ({ demo: false }))
const api = vi.hoisted(() => ({ loadStudent: vi.fn(), resetLoginCode: vi.fn(), allowRetake: vi.fn() }))
vi.mock('../studentApi', () => api)
vi.mock('@/lib/session', async (orig) => ({ ...(await orig<typeof import('@/lib/session')>()), isDemoMode: () => h.demo }))

const open = () => renderAt(<StudentPage />, { path: '/instructor/:classId/students/:studentId', url: `/instructor/${CLASS}/students/${SEAT}` })

beforeEach(() => {
  vi.clearAllMocks()
  h.demo = false
  api.loadStudent.mockResolvedValue({ input: demoReportInput(NOW), memberId: SEAT, profileId: DEMO_STUDENT_ID })
})

describe('the student page', () => {
  it('loads this student in this class and shows the header, status and key numbers', async () => {
    open()
    expect(await screen.findByRole('heading', { level: 2, name: 'Ava K.' })).toBeInTheDocument()
    expect(api.loadStudent).toHaveBeenCalledWith(CLASS, SEAT)
    expect(screen.getByText('No activity for 4 days')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByText(/5 of 6 required · class median 80%/)).toBeInTheDocument()
    // Once in the summary card and once in the learning-gain table.
    expect(screen.getAllByText('+25 pts')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Back to the class' })).toHaveAttribute('href', `/instructor/${CLASS}`)
  })

  it('has every analytics section, each with its own heading', async () => {
    open()
    await screen.findByRole('heading', { level: 2, name: 'Ava K.' })
    const sections = screen.getAllByRole('heading', { level: 3 }).map((e) => e.textContent)
    expect(sections).toEqual([
      'Actions', 'Note home', 'AI instructor insight', 'Suggested next steps', 'Progress through the class', 'Learning gain', 'Concept mastery',
      'Accuracy and mistakes', 'Engagement', 'Hints', 'Struggles',
    ])
  })

  it('shows the next steps, most urgent first', async () => {
    open()
    const steps = within(await screen.findByRole('region', { name: 'Suggested next steps' })).getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent(/^Urgent: No activity for 4 days/)
    expect(steps[1]).toHaveTextContent('Worth doing: Review Loops: mastery 45% against 75% for the class.')
  })

  it('shows each pre/post question pair and its result', async () => {
    open()
    const gain = await screen.findByRole('region', { name: 'Learning gain' })
    const pairs = within(gain).getByRole('table', { name: 'Each pre-test question and its matching post-test question' })
    const results = within(pairs).getAllByRole('row').slice(1).map((r) => r.lastElementChild?.textContent)
    expect(results).toEqual(['Slipped', 'Learned', 'Already knew', 'Learned'])
    expect(within(gain).getByText('Learned:')).toHaveTextContent('Learned: 2')
  })

  it('compares each concept with the class and names the one to focus on', async () => {
    open()
    const mastery = await screen.findByRole('table', { name: 'Concept mastery compared with the class' })
    const loops = within(mastery).getByRole('row', { name: /Loops/ })
    expect(loops).toHaveTextContent('45%')
    expect(loops).toHaveTextContent('75%')
    expect(loops).toHaveTextContent('Focus here')
  })

  it('lists the wrong choice the student keeps picking', async () => {
    open()
    const choices = await screen.findByRole('table', { name: /Wrong choices this student picked/ })
    expect(within(choices).getAllByRole('row')[1]).toHaveTextContent('Loops worksheetHow many times does for i in range(3) run?22')
  })

  it('says it cannot find a student that is not in this class, with a way to retry', async () => {
    api.loadStudent.mockRejectedValue(new SessionError('That student was not found in this class.', 'not_found'))
    open()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That student was not found in this class.')
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has no serious accessibility problems', async () => {
    const { container } = open()
    await screen.findByRole('heading', { level: 2, name: 'Ava K.' })
    await expectNoSeriousA11yViolations(container)
  })
})

describe('actions', () => {
  it('resets the login code only after confirming, and shows the new code once', async () => {
    api.resetLoginCode.mockResolvedValue('ABCD-EFGH-JKLM-NPQR')
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reset login code' }))
    expect(api.resetLoginCode).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Confirm login code reset' })).toHaveTextContent(/old code stop working/)
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reset the code' }))
    expect(api.resetLoginCode).toHaveBeenCalledWith(SEAT)
    expect(await screen.findByText('ABCD-EFGH-JKLM-NPQR')).toBeInTheDocument()
  })

  it('can cancel a reset', async () => {
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reset login code' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Confirm login code reset' })).not.toBeInTheDocument()
    expect(api.resetLoginCode).not.toHaveBeenCalled()
  })

  it('shows the database message when a reset is refused', async () => {
    api.resetLoginCode.mockRejectedValue(new SessionError('Not allowed to reset this code'))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reset login code' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reset the code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed to reset this code')
  })

  it('allows a test retake after confirming, then reloads the student', async () => {
    api.allowRetake.mockResolvedValue(undefined)
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Allow a retake of Variables and Loops pre-test' }))
    expect(api.allowRetake).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove this result' }))
    expect(api.allowRetake).toHaveBeenCalledWith(DEMO_STUDENT_ID, CLASS, 't-pre')
    expect(await screen.findByText('Done. The student can take that test again.')).toBeInTheDocument()
    await waitFor(() => expect(api.loadStudent).toHaveBeenCalledTimes(2))
  })

  it('copies the drafted note (the instructor sends it, not the system)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Copy note' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Hi Ava, you have finished 83%/))
    expect(await screen.findByText(/Note copied/)).toBeInTheDocument()
  })

  it('downloads a CSV with one row per activity', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    const csv = reportCsv(buildStudentReport(demoReportInput(NOW))).trim().split('\r\n')
    expect(csv[0]).toBe('module,lesson,activity,type,required,status,tries,first_try,hints,minutes,class_median_minutes')
    expect(csv).toHaveLength(7)
    expect(csv[5]).toBe('Variables and Loops,Loops,Loops worksheet,worksheet,yes,completed,4,wrong,2,15,6')
  })
})

describe('demo mode', () => {
  it('shows sample data and turns off actions that change data', async () => {
    h.demo = true
    open()
    expect(screen.getByText('Demo mode: this is sample data, not a real student.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset login code' })).toBeDisabled()
    expect(api.loadStudent).not.toHaveBeenCalled()
  })
})
