// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, renderAt } from '../test/harness'
import { ImpactReport } from '../ImpactReport'

const m = vi.hoisted(() => ({ loadReport: vi.fn() }))
vi.mock('../reportApi', () => ({ loadReport: m.loadReport }))

const gain = (over: object) => ({ module_id: 'm1', concept_id: null, pre_pct: 40, post_pct: 72, gain_points: 32, normalized_gain: 0.53, complete_count: 10, incomplete_count: 1, ...over })
const data = (over: object = {}) => ({
  className: 'Demo Period 1', school: 'Demo High School', term: 'Fall 2026',
  rows: [gain({}), gain({ concept_id: 'loops', pre_pct: 30, post_pct: 75, gain_points: 45 }), gain({ module_id: 'm2', complete_count: 6 })],
  moduleTitles: new Map([['m1', 'Variables and Loops'], ['m2', 'Functions']]),
  conceptNames: new Map([['loops', 'Loops']]),
  students: 11, avgCompletion: 77.14, ...over,
})
const open = () => renderAt(<ImpactReport />, { path: '/instructor/:classId/report', url: '/instructor/c1/report' })

beforeEach(() => vi.clearAllMocks())

describe('impact report', () => {
  it('shows the headline, the numbers and a table, with no serious axe violations', async () => {
    m.loadReport.mockResolvedValue(data())
    const { container } = open()
    expect(await screen.findByRole('heading', { name: 'Demo Period 1' })).toBeInTheDocument()
    expect(screen.getByText(/Demo High School, Fall 2026/)).toBeInTheDocument()
    expect(screen.getByText('77%')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'Functions' })
    expect(within(section).getByText(/went from 40% on the pre-test to 72% on the post-test \(\+32 points\)/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Module'), 'm1')
    const loops = screen.getByRole('region', { name: 'Variables and Loops' })
    expect(within(loops).getByText(/The biggest gain was in Loops: \+45 points/)).toBeInTheDocument()
    expect(within(within(loops).getByRole('table')).getByRole('row', { name: /Loops/ })).toHaveTextContent('+45 pts')
    expect(container.textContent).not.toMatch(/student_id|Maya|Sam/)
    await expectNoSeriousA11yViolations(container)
  })

  it('prints and downloads a CSV', async () => {
    m.loadReport.mockResolvedValue(data())
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: /Download CSV/ }))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('says plainly when there are no results yet, and warns for a small group', async () => {
    m.loadReport.mockResolvedValueOnce(data({ rows: [] }))
    const first = open()
    expect(await screen.findByText(/No pre-test or post-test results yet/)).toBeInTheDocument()
    first.unmount()
    m.loadReport.mockResolvedValue(data({ rows: [gain({ complete_count: 3 })] }))
    open()
    expect(await screen.findByText(/Fewer than 5 students have both tests/)).toBeInTheDocument()
  })

  it('shows an error with Try again', async () => {
    m.loadReport.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(data())
    open()
    expect(await screen.findByText(/We could not load the report/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Demo Period 1' })).toBeInTheDocument()
  })
})
