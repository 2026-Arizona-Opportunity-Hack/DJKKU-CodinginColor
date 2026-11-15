// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'
import { LiveView } from '../LiveView'

const m = vi.hoisted(() => ({ loadLive: vi.fn() }))
vi.mock('../liveApi', () => ({ loadLive: m.loadLive }))

const snapshot = (over: object = {}) => ({
  activities: [
    { id: 'a1', title: 'Watch: variables', kind: 'video', module: 'Variables and Loops', lesson: 'Variables' },
    { id: 'a2', title: 'Variables check', kind: 'check', module: 'Variables and Loops', lesson: 'Variables' },
  ],
  students: [{ id: 's1', name: 'Maya Rivera' }, { id: 's2', name: 'Sam Patel' }],
  progress: [
    { student_id: 's1', activity_id: 'a1', status: 'completed', updated_at: '2026-11-15T10:00:00Z' },
    { student_id: 's2', activity_id: 'a2', status: 'in_progress', updated_at: '2026-11-15T10:00:00Z' },
  ],
  stuck: [{ student_id: 's2', activity_id: 'a2', reasons: ['wrong_attempts', 'long_time'] }],
  ...over,
})
const open = () => renderAt(<LiveView />, { path: '/instructor/:classId/live', url: '/instructor/c1/live' })

beforeEach(() => vi.clearAllMocks())

describe('live class view', () => {
  it('shows who needs help and a status grid, with initials by default, and no serious axe violations', async () => {
    m.loadLive.mockResolvedValue(snapshot())
    const { container } = open()
    const help = await screen.findByRole('region', { name: /Needs help now \(1\)/ })
    expect(within(help).getByText('S. P.')).toBeInTheDocument()
    expect(within(help).getByText(/On "Variables check": 3 or more wrong tries, over 10 minutes on one activity/)).toBeInTheDocument()
    const maya = screen.getByRole('row', { name: /M\. R\./ })
    expect(within(maya).getByText('Done')).toBeInTheDocument()
    expect(within(maya).getByText('1 of 2')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /^S\. P\./ })).getByText('Stuck')).toBeInTheDocument()
    expect(container.textContent).not.toContain('Maya Rivera')
    expect(screen.getByText(/Names are shown as initials/)).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('shows full names on request, and can pause the updates', async () => {
    m.loadLive.mockResolvedValue(snapshot())
    open()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show full names' }))
    expect(screen.getByRole('row', { name: /Maya Rivera/ })).toBeInTheDocument()
    const pause = screen.getByRole('button', { name: 'Pause updates' })
    await userEvent.click(pause)
    expect(screen.getByRole('button', { name: 'Resume updates' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Paused.')
  })

  it('says what to do when nothing is assigned or nobody has signed in', async () => {
    m.loadLive.mockResolvedValueOnce(snapshot({ activities: [] }))
    const first = open()
    expect(await screen.findByText('No module is assigned to this class yet.')).toBeInTheDocument()
    first.unmount()
    m.loadLive.mockResolvedValue(snapshot({ students: [] }))
    open()
    expect(await screen.findByText(/No student has signed in yet/)).toBeInTheDocument()
  })

  it('says nobody is stuck, and shows an error with Try again', async () => {
    m.loadLive.mockResolvedValueOnce(snapshot({ stuck: [] }))
    const first = open()
    expect(await screen.findByText('Nobody is flagged as stuck right now.')).toBeInTheDocument()
    first.unmount()
    m.loadLive.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(snapshot())
    open()
    expect(await screen.findByText(/We could not load the live view/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: /Needs help now/ })).toBeInTheDocument()
  })
})
