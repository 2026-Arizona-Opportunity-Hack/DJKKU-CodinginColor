// @vitest-environment jsdom
import '../test/setup'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { MockState } from '@/features/player/api.mock'
import { ApiError } from '@/features/player/errors'
import { log } from '@/lib/log'
import { CLASS_ID, expectNoSeriousA11yViolations, MID_MODULE, mockApi, renderRoute } from '@/features/player/test/render'

import { ActivityPage } from '../pages/ActivityPage'

const BEFORE_EXIT: Partial<MockState> = {
  ...MID_MODULE,
  done: [...(MID_MODULE.done ?? []), 'act-loops-sheet', 'act-loops-check'],
}

function openActivity(activityId: string, state: Partial<MockState> = MID_MODULE, hintsEnabled = false) {
  const api = mockApi(state)
  const utils = renderRoute(<ActivityPage hintsEnabled={hintsEnabled} />, {
    path: '/learn/:classId/a/:activityId',
    url: `/learn/${CLASS_ID}/a/${activityId}`,
    api,
  })
  return { ...utils, api }
}

describe('B8 activity player', () => {
  it('video: privacy-enhanced embed, transcript and link fallback', async () => {
    const { container } = openActivity('act-vars-video')
    const frame = await screen.findByTitle(/Video: Watch: what is a variable/)
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//)
    expect(screen.getByText('Read the transcript')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open it on YouTube/ })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('reading: markdown renders, raw HTML does not', async () => {
    const api = mockApi(MID_MODULE)
    const real = api.getActivity.bind(api)
    vi.spyOn(api, 'getActivity').mockImplementation(async (id) => {
      const a = await real(id)
      return a.kind === 'reading' ? { ...a, content: { body: '## Hi\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1))' } } : a
    })
    const { container } = renderRoute(<ActivityPage hintsEnabled={false} />, {
      path: '/learn/:classId/a/:activityId',
      url: `/learn/${CLASS_ID}/a/act-vars-read`,
      api,
    })
    expect(await screen.findByRole('heading', { name: 'Hi' })).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('bad').closest('a')?.getAttribute('href') ?? '').toBe('')
  })

  it('check (mcq): validates, then shows correct + feedback + Next', async () => {
    const { container, api } = openActivity('act-vars-check')
    const submit = vi.spyOn(api, 'submitAnswer')
    await userEvent.click(await screen.findByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText('Choose an answer.')).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('radio', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText('Correct')).toBeInTheDocument()
    expect(submit).toHaveBeenCalledWith('act-vars-check', { answers: { 'q-vars-1': { choice_id: 'b' } } })
    expect(screen.getByRole('link', { name: /Next/ })).toHaveAttribute('href', `/learn/${CLASS_ID}/a/act-loops-sheet`)
    await expectNoSeriousA11yViolations(container)
  })

  it('worksheet: short answer, fill in the blank and keyboard ordering build one response', async () => {
    const { api, container } = openActivity('act-loops-sheet')
    const submit = vi.spyOn(api, 'submitAnswer')
    await userEvent.type(await screen.findByRole('textbox', { name: /built-in function/ }), 'range')
    await userEvent.type(screen.getByRole('textbox', { name: 'Blank 1 of 2' }), 'for')
    await userEvent.type(screen.getByRole('textbox', { name: 'Blank 2 of 2' }), 'range')
    // Lane C's splitQuestion ships l2, l1, l3 (never the solved order). Keyboard only: focus, press Enter.
    screen.getByRole('button', { name: 'Move "i = 0" up' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Moved "i = 0" to position 1 of 3/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send worksheet' }))
    expect(await screen.findByText('3 of 3 correct.')).toBeInTheDocument()
    expect(submit).toHaveBeenCalledWith('act-loops-sheet', {
      answers: {
        'q-loop-sa': { text: 'range' },
        'q-loop-fb': { blanks: ['for', 'range'] },
        'q-loop-ord': { order: ['l1', 'l2', 'l3'] },
      },
    })
    await expectNoSeriousA11yViolations(container)
  })

  it('fill in the blank: an empty blank is flagged next to the field', async () => {
    const { api } = openActivity('act-loops-check', { ...MID_MODULE, done: [...MID_MODULE.done!, 'act-loops-sheet'] })
    const submit = vi.spyOn(api, 'submitAnswer')
    await userEvent.click(await screen.findByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText('Fill in this blank.')).toBeInTheDocument()
    expect(screen.getByText(/Check 1 answer above/)).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it('exit (reflection, unscored): finishing the module shows the unlock message', async () => {
    const { container } = openActivity('act-basics-exit', BEFORE_EXIT)
    const box = await screen.findByRole('textbox', { name: /hardest part/ })
    expect(screen.getByText('(not graded)')).toBeInTheDocument()
    await userEvent.type(box, 'Off-by-one; the trace table helped.')
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText('Module complete, Functions unlocked')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('a locked activity explains why, with a way back', async () => {
    openActivity('act-basics-exit')
    expect(await screen.findByText('Not open yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your path' })).toBeInTheDocument()
  })
})

describe('B13 failed submit', () => {
  it('offline: says the answer was not sent, keeps it in the form, re-enables submit', async () => {
    const logged = vi.spyOn(log, 'error').mockImplementation(() => {})
    const { api } = openActivity('act-vars-check')
    vi.spyOn(api, 'submitAnswer').mockRejectedValue(new ApiError('offline', { requestId: 'off-1234' }))
    await userEvent.click(await screen.findByRole('radio', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText(/You're offline; your answer wasn't sent/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeEnabled()
    expect(logged).toHaveBeenCalledTimes(1)
  })
})

describe('B9 hints', () => {
  async function answerWrong() {
    await userEvent.click(await screen.findByRole('radio', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    await screen.findByText('Not yet')
  }

  it('is hidden when the flag is off', async () => {
    openActivity('act-vars-check', MID_MODULE, false)
    await answerWrong()
    expect(screen.queryByRole('button', { name: /Get a hint/ })).toBeNull()
  })

  it('appears after a wrong answer, shows plain-text hints, counts down, disables after 3', async () => {
    const { container } = openActivity('act-vars-check', MID_MODULE, true)
    await answerWrong()
    const button = screen.getByRole('button', { name: 'Get a hint' })
    await userEvent.click(button)
    expect(await screen.findByText(/Re-read the question/)).toBeInTheDocument()
    expect(screen.getByText('2 of 3 left')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Get a hint' }))
    await screen.findByText('1 of 3 left')
    await userEvent.click(screen.getByRole('button', { name: 'Get a hint' }))
    expect(await screen.findByText('No hints left for this question.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get a hint' })).toBeDisabled()
    await expectNoSeriousA11yViolations(container)
  })

  it.each([
    ['429', new ApiError('rate_limited', { status: 429, requestId: 'r429' })],
    ['500', new ApiError('unavailable', { status: 500, requestId: 'r500' })],
  ])('on %s shows the friendly fallback and the lesson keeps working', async (_s, err) => {
    vi.spyOn(log, 'error').mockImplementation(() => {})
    const { api } = openActivity('act-vars-check', MID_MODULE, true)
    vi.spyOn(api, 'requestHint').mockRejectedValue(err)
    await answerWrong()
    await userEvent.click(screen.getByRole('button', { name: 'Get a hint' }))
    const region = screen.getByRole('region', { name: 'Hints' })
    expect(await within(region).findByText(/Hints aren't available right now/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    expect(await screen.findByText('Correct')).toBeInTheDocument()
  })
})
