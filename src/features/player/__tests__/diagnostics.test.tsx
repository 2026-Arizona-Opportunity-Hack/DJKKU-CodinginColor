// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActivityPage } from '@/features/player/pages/ActivityPage'
import { log, minLevel, redact } from '@/lib/log'
import { CLASS_ID, MID_MODULE, mockApi, renderRoute } from '@/features/player/test/render'

import { ApiError, fromHttpStatus, fromRpcError } from '../errors'

describe('B14 diagnostics', () => {
  it('a submit failure logs exactly once, with requestId and cause, and never the answer', async () => {
    const errorSink = vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = mockApi(MID_MODULE)
    const cause = new Error('upstream timeout')
    vi.spyOn(api, 'submitAnswer').mockRejectedValue(new ApiError('unavailable', { requestId: 'req-4242', cause }))
    renderRoute(<ActivityPage hintsEnabled={false} />, {
      path: '/learn/:classId/a/:activityId',
      url: `/learn/${CLASS_ID}/a/act-vars-check`,
      api,
    })
    await userEvent.click(await screen.findByRole('radio', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    await screen.findByText(/isn't available right now/)

    const submitLogs = errorSink.mock.calls.filter(([msg]) => String(msg).includes('student.submit.fail'))
    expect(submitLogs).toHaveLength(1)
    const record = submitLogs[0]![1] as Record<string, unknown>
    expect(record).toMatchObject({
      event: 'student.submit.fail',
      level: 'error',
      requestId: 'req-4242',
      errorCode: 'unavailable',
      cause: { name: 'Error', message: 'upstream timeout' },
    })
    expect(JSON.stringify(record)).not.toContain('choice_id')
  })

  it('redacts codes, answers, names and tokens', () => {
    expect(
      redact({ code: 'BLUE-FOX-27', display_name: 'Maya', response: { text: 'x' }, token: 't', requestId: 'r', errorCode: 'locked' }),
    ).toEqual({
      code: '[redacted]',
      display_name: '[redacted]',
      response: '[redacted]',
      token: '[redacted]',
      requestId: 'r',
      errorCode: 'locked',
    })
  })

  it('debug is off by default and on with localStorage.debug=cic', () => {
    expect(minLevel()).not.toBe('debug')
    window.localStorage.setItem('debug', 'cic')
    expect(minLevel()).toBe('debug')
    const sink = vi.spyOn(console, 'debug').mockImplementation(() => {})
    log.debug('x.y')
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('maps server errors to codes in one place', () => {
    expect(fromRpcError({ message: 'locked', code: 'P0001' }, 'r').code).toBe('locked')
    expect(fromRpcError({ message: 'boom', hint: 'already_taken' }, 'r').code).toBe('already_taken')
    expect(fromRpcError({ message: 'jwt expired', code: 'PGRST301' }, 'r').code).toBe('unauthenticated')
    expect(fromRpcError({ message: 'TypeError: Failed to fetch' }, 'r').code).toBe('offline')
    expect(fromHttpStatus(429, 'r').code).toBe('rate_limited')
    expect(fromHttpStatus(503, 'r').code).toBe('unavailable')
  })
})
