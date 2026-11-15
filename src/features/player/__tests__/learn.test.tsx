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
    const card = await screen.findByRole('link', { name: /Start: Python basics pre-test/ })
    expect(card).toHaveAttribute('href', `/learn/${CLASS_ID}/test/pre-basics`)
    expect(screen.queryByText(/finished everything/)).toBeNull() // the old bug: null next meant "done"
  })

  it('sends a student who finished every activity to the post-test, not to "done"', async () => {
    const all = ['act-vars-video', 'act-vars-read', 'act-vars-check', 'act-loops-sheet', 'act-loops-check', 'act-basics-exit']
    const api = mockApi({ me: MAYA, done: all, assessments: { 'pre-basics': { score_pct: 33 } } })
    expect(await api.nextActivity(CLASS_ID)).toBeNull()
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api })
    const card = await screen.findByRole('link', { name: /Finish: Python basics post-test/ })
    expect(card).toHaveAttribute('href', `/learn/${CLASS_ID}/test/post-basics`)
  })

  it('says done only when nothing is left', async () => {
    const all = ['act-vars-video', 'act-vars-read', 'act-vars-check', 'act-loops-sheet', 'act-loops-check', 'act-basics-exit', 'act-fn-video', 'act-fn-check', 'act-fn-exit']
    const assessments = { 'pre-basics': { score_pct: 33 }, 'post-basics': { score_pct: 100 }, 'pre-functions': { score_pct: 0 }, 'post-functions': { score_pct: 100 } }
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api: mockApi({ me: MAYA, done: all, assessments }) })
    expect(await screen.findByText(/You've finished everything in this class/)).toBeInTheDocument()
  })

  it('shows the error state with a reference and Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = mockApi(MID_MODULE)
    vi.spyOn(api, 'getMyClasses').mockRejectedValue(new ApiError('unavailable', { requestId: 'feedbeef-1' }))
    renderRoute(<LearnHomePage />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Reference: feedbeef/)
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('redirects a signed-out device to /sign-in', async () => {
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api: mockApi({ me: null }) })
    expect(await screen.findByTestId('location')).toHaveTextContent('/sign-in')
  })

  it('tells staff this area is for students, with a way home, and no error', async () => {
    const api = mockApi({ me: { ...MAYA, role: 'instructor', class_id: null, class_name: null } })
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByText('This area is for students')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tells a student with no class to use their code or link', async () => {
    const api = mockApi({ me: { ...MAYA, display_name: '', class_id: null, class_name: null } })
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByText("You're not in a class yet")).toBeInTheDocument()
    expect(screen.getByText('Use your login code or class link.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/sign-in')
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

  it('rounds the long decimals the database sends, and shows a missing gain as "Not yet", never 0', async () => {
    const api = mockApi(MID_MODULE)
    vi.spyOn(api, 'getMyProgress').mockResolvedValue({
      completed: 3,
      total: 9,
      modules: [
        { title: 'Python basics', pct: 33.333333333333336, pre_pct: 33.33333333333333, post_pct: 100.000000000000000000000, gain: 66.66666666666667 },
        { title: 'Functions', pct: 0, pre_pct: 50, post_pct: null, gain: null },
      ],
    })
    renderRoute(<ProgressPage />, { path: '/learn/:classId/progress', url: `/learn/${CLASS_ID}/progress`, api })
    expect(await screen.findByText('33% of activities done')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument() // pre
    expect(screen.getByText('100%')).toBeInTheDocument() // post
    expect(screen.getByText('+67 points')).toBeInTheDocument()
    expect(screen.getByText('Not yet')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\d\.\d{3}|0 points/)
  })
})
