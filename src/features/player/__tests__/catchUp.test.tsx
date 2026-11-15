// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, MAYA, MID_MODULE, mockApi, renderRoute } from '@/features/player/test/render'
import { LearnHomePage } from '../pages/LearnHomePage'

describe('catch-up plan on Start here', () => {
  it('shows what is left and about how long it takes, from the mock', async () => {
    const { container } = renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api: mockApi(MID_MODULE) })
    expect(await screen.findByRole('heading', { name: 'What is left' })).toBeInTheDocument()
    expect(screen.getByText(/steps left, about \d+ minutes/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('See the steps'))
    expect(screen.getByText(/Loops worksheet/, { selector: 'li' })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('says, kindly, when a student is behind the class', async () => {
    const api = mockApi({ me: MAYA })
    vi.spyOn(api, 'getCatchUp').mockResolvedValue({
      steps_left: 8, minutes_left: 25, behind_by: 4,
      steps: [{ kind: 'pretest', activity_id: null, assessment_id: 'pre-basics', title: 'Pre-test: Python basics', minutes: 5 }],
    })
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByRole('heading', { name: 'Your catch-up plan' })).toBeInTheDocument()
    expect(screen.getByText(/You are 4 steps behind the class. That happens, and it is fixable: 8 steps left, about 25 minutes./)).toBeInTheDocument()
    expect(screen.getByText('And 7 more after these.')).toBeInTheDocument()
  })

  it('shows nothing when everything is done, and a quiet note if the plan fails', async () => {
    const api = mockApi(MID_MODULE)
    vi.spyOn(api, 'getCatchUp').mockResolvedValueOnce({ steps_left: 0, minutes_left: 0, behind_by: 0, steps: [] })
    const first = renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api })
    await screen.findByRole('link', { name: /Continue/ })
    expect(screen.queryByText('What is left')).toBeNull()
    first.unmount()
    const api2 = mockApi(MID_MODULE)
    vi.spyOn(api2, 'getCatchUp').mockRejectedValue(new Error('x'))
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api: api2 })
    expect(await screen.findByText(/catch-up plan didn't load/)).toBeInTheDocument()
  })
})
