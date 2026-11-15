// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, fromRpcError } from '@/features/player/errors'
import { GUEST_STORAGE_KEY, markGuestCompleted, readGuestProgress } from '@/features/player/guestProgress'
import { log } from '@/lib/log'
import { expectNoSeriousA11yViolations, MAYA, mockApi, renderRoute } from '@/features/player/test/render'

import { ExplorePage } from '../pages/ExplorePage'
import { GuestActivityPage } from '../pages/GuestActivityPage'
import { LearnLayout } from '../pages/LearnLayout'
import { SaveProgressPage } from '../pages/SaveProgressPage'

describe('B3 guest progress storage', () => {
  it('persists across reloads (a fresh read sees the same data)', () => {
    markGuestCompleted('act-vars-video', new Date('2026-11-14T10:00:00Z'))
    expect(readGuestProgress()).toEqual({
      version: 1,
      completed: { 'act-vars-video': { completed_at: '2026-11-14T10:00:00.000Z' } },
    })
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['an old version', JSON.stringify({ version: 0, completed: {} })],
    ['a wrong shape', JSON.stringify({ version: 1, completed: { x: { completed_at: 'yesterday' } } })],
  ])('resets safely on %s', (_label, raw) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    window.localStorage.setItem(GUEST_STORAGE_KEY, raw)
    expect(readGuestProgress()).toEqual({ version: 1, completed: {} })
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull()
  })
})

describe('B3 guest mode pages', () => {
  it('lists open modules and shows device progress', async () => {
    markGuestCompleted('act-vars-video')
    // A real guest: no session (the mock otherwise starts signed in as the demo student).
    const { container } = renderRoute(<ExplorePage />, { path: '/explore', url: '/explore', api: mockApi({ me: null }) })
    expect(await screen.findByRole('heading', { name: 'Python basics' })).toBeInTheDocument()
    expect(screen.queryByText('Functions')).not.toBeInTheDocument() // not published as open
    expect(screen.getByText(/1 activity done/)).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('lets a guest finish an activity with no account, saved on the device', async () => {
    const api = mockApi({ me: null })
    const submit = vi.spyOn(api, 'submitAnswer')
    const { container } = renderRoute(<GuestActivityPage />, { path: '/explore/a/:activityId', url: '/explore/a/act-vars-read', api })
    await userEvent.click(await screen.findByRole('button', { name: "I've read it" }))
    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
    expect(readGuestProgress().completed['act-vars-read']).toBeDefined()
    expect(submit).not.toHaveBeenCalled()
    await expectNoSeriousA11yViolations(container)
  })
})

describe('open lessons for a signed-in student (no guest prompts)', () => {
  it('explore offers Start here instead of "Save my progress", and hides device-only badges', async () => {
    markGuestCompleted('act-vars-video') // left over from guest browsing on this device
    const { container } = renderRoute(<ExplorePage />, { path: '/explore', url: '/explore', api: mockApi({ me: MAYA }) })
    expect(await screen.findByRole('heading', { name: 'Python basics' })).toBeInTheDocument()
    expect(await screen.findByText('Open lessons for practice')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Start here' })).toHaveAttribute('href', '/learn')
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument()
    expect(screen.queryByText("You're browsing as a guest")).toBeNull()
    expect(screen.queryByRole('link', { name: 'Save my progress' })).toBeNull()
    expect(screen.queryByText('Done')).toBeNull() // guest progress is not their progress
    await expectNoSeriousA11yViolations(container)
  })

  it('finishing an open activity says it is practice, never "Save my progress"', async () => {
    const api = mockApi({ me: MAYA })
    const submit = vi.spyOn(api, 'submitAnswer')
    renderRoute(<GuestActivityPage />, { path: '/explore/a/:activityId', url: '/explore/a/act-vars-read', api })
    expect(await screen.findByText(/Reading · Practice/)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: "I've read it" }))
    expect(await screen.findByText('Practice done')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Start here' })).toBeInTheDocument()
    expect(screen.queryByText('Saved on this device')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Save my progress' })).toBeNull()
    expect(submit).not.toHaveBeenCalled() // open lessons stay ungraded, as for guests
  })

  it('an open lesson that is also class work says so and points to Start here (no endless loading)', async () => {
    const api = mockApi({ me: MAYA })
    vi.spyOn(api, 'getOpenActivity').mockRejectedValue(new ApiError('locked'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoute(<GuestActivityPage />, { path: '/explore/a/:activityId', url: '/explore/a/act-vars-read', api })
    expect(await screen.findByText('This lesson is part of your class')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Start here' })).toHaveAttribute('href', '/learn')
  })

  it('the database wording for a locked activity is recognised as "locked" (so it is not retried)', () => {
    const err = fromRpcError({ message: 'This activity is locked: Take the pre-test first', code: 'P0001' }, 'req-1')
    expect(err.code).toBe('locked')
    expect(fromRpcError({ message: 'Something else went wrong', code: 'P0001' }, 'req-2').code).toBe('unknown')
  })

  it('a guest still sees the guest version', async () => {
    renderRoute(<ExplorePage />, { path: '/explore', url: '/explore', api: mockApi({ me: null }) })
    expect(await screen.findByText("You're browsing as a guest")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Save my progress' })).toBeInTheDocument()
    expect(screen.queryByText('Open lessons for practice')).toBeNull()
  })
})

describe('B4 self-register', () => {
  async function register(name: string) {
    await userEvent.type(screen.getByLabelText('Display name'), name)
    await userEvent.click(screen.getByRole('button', { name: 'Save my progress' }))
  }

  it('registers once, copies device progress right away, and shows the code once with where it is for', async () => {
    markGuestCompleted('act-vars-video')
    const api = mockApi()
    const registerSpy = vi.spyOn(api, 'selfRegister')
    const importSpy = vi.spyOn(api, 'importGuestProgress')
    const { container } = renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText('GREEN-OWL-41')).toBeInTheDocument()
    expect(screen.getByText("Write this down. You'll need it on another device.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to my lessons' })).toHaveAttribute('href', '/learn')
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(importSpy).toHaveBeenCalledTimes(1)
    expect(readGuestProgress().completed).toEqual({}) // merged, so cleared from the device
    await expectNoSeriousA11yViolations(container)
  })

  it('still shows the code if copying device progress fails, and keeps the device copy for a retry', async () => {
    vi.spyOn(log, 'error').mockImplementation(() => {})
    markGuestCompleted('act-vars-video')
    const api = mockApi()
    vi.spyOn(api, 'importGuestProgress').mockRejectedValue(new ApiError('unavailable', { requestId: 'imp-2' }))
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText('GREEN-OWL-41')).toBeInTheDocument()
    expect(readGuestProgress().completed['act-vars-video']).toBeDefined()
  })

  it('shows a friendly message when this device already belongs to a class', async () => {
    vi.spyOn(log, 'error').mockImplementation(() => {})
    const api = mockApi()
    vi.spyOn(api, 'selfRegister').mockRejectedValue(new ApiError('already_in_class', { requestId: 'dup-1' }))
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText(/already in a class/)).toBeInTheDocument()
  })

  it('rejects emails and links on the client', async () => {
    const api = mockApi()
    const spy = vi.spyOn(api, 'selfRegister')
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('sam@example.com')
    expect(await screen.findByText('Leave out email addresses.')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveAttribute('aria-invalid', 'true')
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a friendly message on 429 and keeps the name in the form', async () => {
    vi.spyOn(log, 'error').mockImplementation(() => {})
    const api = mockApi()
    vi.spyOn(api, 'selfRegister').mockRejectedValue(new ApiError('rate_limited', { status: 429, requestId: 'ratelimit-1' }))
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText(/Too many tries right now/)).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue('Sam P.')
  })

  it('after sign-in, merges device progress exactly once and clears it', async () => {
    markGuestCompleted('act-vars-video')
    const api = mockApi({ me: MAYA })
    const importSpy = vi.spyOn(api, 'importGuestProgress')
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByText(/We copied 1 finished activity/)).toBeInTheDocument()
    expect(importSpy).toHaveBeenCalledTimes(1)
    expect(readGuestProgress().completed).toEqual({})
  })

  it('if the merge fails, says so and keeps device progress', async () => {
    const logged = vi.spyOn(log, 'error').mockImplementation(() => {})
    markGuestCompleted('act-vars-video')
    const api = mockApi({ me: MAYA })
    vi.spyOn(api, 'importGuestProgress').mockRejectedValue(new ApiError('unavailable', { requestId: 'imp-1' }))
    renderRoute(<LearnLayout />, { path: '/learn', url: '/learn', api })
    expect(await screen.findByText(/didn't copy over/)).toBeInTheDocument()
    expect(readGuestProgress().completed['act-vars-video']).toBeDefined()
    expect(logged).toHaveBeenCalledWith('student.guest.import.fail', expect.objectContaining({ requestId: 'imp-1' }))
  })
})

describe('review fixes', () => {
  it('the last guest activity links back to /learn/explore, not a dead /explore', async () => {
    markGuestCompleted('act-basics-exit')
    renderRoute(<GuestActivityPage />, { path: '/learn/explore/a/:activityId', url: '/learn/explore/a/act-basics-exit' })
    expect(await screen.findByRole('link', { name: /All open lessons/, description: '' })).toHaveAttribute('href', '/learn/explore')
    for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).toMatch(/^\/learn\//)
  })

  it('keeps the issued code across a reload, so a second click cannot create a second account', async () => {
    const api = mockApi()
    const registerSpy = vi.spyOn(api, 'selfRegister')
    const first = renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await userEvent.type(screen.getByLabelText('Display name'), 'Sam P.')
    await userEvent.click(screen.getByRole('button', { name: 'Save my progress' }))
    await screen.findByText('GREEN-OWL-41')
    first.unmount()
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    expect(await screen.findByText('GREEN-OWL-41')).toBeInTheDocument()
    expect(screen.queryByLabelText('Display name')).toBeNull()
    expect(registerSpy).toHaveBeenCalledTimes(1)
  })

  it('blocked storage never crashes: reads return empty, writes are no-ops, one warn', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {})
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      expect(readGuestProgress()).toEqual({ version: 1, completed: {} })
      expect(() => markGuestCompleted('act-vars-video')).not.toThrow()
      expect(warn.mock.calls.filter(([e]) => e === 'storage.unavailable')).toHaveLength(1)
    } finally {
      Object.defineProperty(window, 'localStorage', original)
    }
  })
})
