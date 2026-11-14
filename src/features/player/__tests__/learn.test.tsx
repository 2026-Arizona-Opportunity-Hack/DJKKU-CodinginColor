// @vitest-environment jsdom
import '../test/setup'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/player/errors'
import { CLASS_ID, expectNoSeriousA11yViolations, MAYA, MID_MODULE, mockApi, renderRoute } from '@/features/player/test/render'

import { ActivityPage } from '../pages/ActivityPage'
import { AssessmentPage } from '../pages/AssessmentPage'
import { ClassPathPage } from '../pages/ClassPathPage'
import { LearnHomePage } from '../pages/LearnHomePage'
import { LearnLayout } from '../pages/LearnLayout'
import { ProgressPage } from '../pages/ProgressPage'

describe('B5 Start here', () => {
  it('points a mid-module (late-joining) student at exactly the next activity', async () => {
    const { container } = renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api: mockApi(MID_MODULE) })
    const card = await screen.findByRole('link', { name: /Continue: Loops worksheet/ })
    expect(card).toHaveAttribute('href', `/learn/${CLASS_ID}/a/act-loops-sheet`)
    expect(screen.getByText('Saturday Coders')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('sends a brand-new student to the pretest first', async () => {
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api: mockApi({ me: MAYA }) })
    const card = await screen.findByRole('link', { name: /Start: Python basics pretest/ })
    expect(card).toHaveAttribute('href', `/learn/${CLASS_ID}/test/pre-basics`)
  })

  it('shows the error state with a reference and Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = mockApi(MID_MODULE)
    vi.spyOn(api, 'getMyClasses').mockRejectedValue(new ApiError('unavailable', { requestId: 'feedbeef-1' }))
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Reference: feedbeef/)
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('redirects a signed-out device to /start', async () => {
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api: mockApi() })
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn/start')
  })
})

describe('B6 module path', () => {
  it('shows server statuses, progress bars, and locked items that are not links', async () => {
    const { container } = renderRoute(<ClassPathPage />, { path: '/learn/:classId', url: `/learn/${CLASS_ID}`, api: mockApi(MID_MODULE) })
    const done = await screen.findByRole('link', { name: /Variables check/ })
    expect(within(done).getByText('Done')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Loops worksheet/ })).toHaveTextContent('Ready')

    const lockedRow = screen.getByText('Loops check').closest('li')!
    expect(within(lockedRow).queryByRole('link')).toBeNull()
    expect(within(lockedRow).getByText('Locked')).toBeInTheDocument()
    expect(within(lockedRow).getByText("Finish 'Loops worksheet' first")).toBeInTheDocument()

    expect(screen.getByRole('progressbar', { name: /Overall/ })).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar', { name: /This module/ })).toHaveLength(2)
    await expectNoSeriousA11yViolations(container)
  })

  it('locked items cannot be reached with Tab', async () => {
    renderRoute(<ClassPathPage />, { path: '/learn/:classId', url: `/learn/${CLASS_ID}`, api: mockApi(MID_MODULE) })
    await screen.findByRole('link', { name: /Variables check/ })
    const reached: string[] = []
    for (let i = 0; i < 25; i++) {
      await userEvent.tab()
      const el = document.activeElement
      if (el && el !== document.body) reached.push(el.textContent ?? '')
    }
    expect(reached.some((t) => t.includes('Loops check'))).toBe(false)
    expect(reached.some((t) => t.includes('Loops worksheet'))).toBe(true)
  })
})

describe('B7 pretest gate and tests', () => {
  it('redirects an activity to the module pretest until it is taken', async () => {
    renderRoute(<ActivityPage />, {
      path: '/learn/:classId/a/:activityId',
      url: `/learn/${CLASS_ID}/a/act-vars-video`,
      api: mockApi({ me: MAYA }),
    })
    expect(await screen.findByTestId('location')).toHaveTextContent(`/learn/${CLASS_ID}/test/pre-basics`)
  })

  it('submits once, shows the score (no answers), then stays locked', async () => {
    const api = mockApi({ me: MAYA })
    const spy = vi.spyOn(api, 'submitAssessment')
    const { container } = renderRoute(<AssessmentPage />, {
      path: '/learn/:classId/test/:assessmentId',
      url: `/learn/${CLASS_ID}/test/pre-basics`,
      api,
    })
    await userEvent.click(await screen.findByRole('radio', { name: 'x = 5' }))
    await userEvent.click(screen.getByRole('radio', { name: '3' }))
    await userEvent.type(screen.getByRole('textbox'), 'while')
    const send = screen.getByRole('button', { name: 'Send my pretest' })
    await userEvent.click(send)
    expect(await screen.findByText('Sent. Your score: 100%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send my pretest' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Send my pretest' }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/correct answer/i)).toBeNull()
    await expectNoSeriousA11yViolations(container)
  })

  it('disables the submit button while sending', async () => {
    const api = mockApi({ me: MAYA })
    vi.spyOn(api, 'submitAssessment').mockReturnValue(new Promise(() => {}))
    renderRoute(<AssessmentPage />, { path: '/learn/:classId/test/:assessmentId', url: `/learn/${CLASS_ID}/test/pre-basics`, api })
    await userEvent.click(await screen.findByRole('radio', { name: 'x = 5' }))
    await userEvent.click(screen.getByRole('radio', { name: '3' }))
    await userEvent.type(screen.getByRole('textbox'), 'for')
    await userEvent.click(screen.getByRole('button', { name: 'Send my pretest' }))
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
  })
})

describe('B10 own progress', () => {
  it('shows completed counts, module progress, pre/post and gain', async () => {
    const api = mockApi({
      ...MID_MODULE,
      assessments: { 'pre-basics': { score_pct: 33 }, 'post-basics': { score_pct: 100 } },
    })
    const { container } = renderRoute(<ProgressPage />, { path: '/learn/:classId/progress', url: `/learn/${CLASS_ID}/progress`, api })
    expect(await screen.findByText(/completed/)).toHaveTextContent("You've completed 3 of 9 activities.")
    expect(screen.getByText('+67 points')).toBeInTheDocument()
    expect(screen.getAllByText('Not taken')).toHaveLength(2) // module 2 pre and post
    await expectNoSeriousA11yViolations(container)
  })
})
