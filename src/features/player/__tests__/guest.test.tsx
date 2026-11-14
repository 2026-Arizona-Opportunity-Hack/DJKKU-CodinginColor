// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/player/errors'
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
    const { container } = renderRoute(<ExplorePage />, { path: '/explore', url: '/explore' })
    expect(await screen.findByRole('heading', { name: 'Python basics' })).toBeInTheDocument()
    expect(screen.queryByText('Functions')).not.toBeInTheDocument() // not published as open
    expect(screen.getByText(/1 activity done/)).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('lets a guest finish an activity with no account, saved on the device', async () => {
    const api = mockApi()
    const submit = vi.spyOn(api, 'submitAnswer')
    const { container } = renderRoute(<GuestActivityPage />, { path: '/explore/a/:activityId', url: '/explore/a/act-vars-read', api })
    await userEvent.click(await screen.findByRole('button', { name: "I've read it" }))
    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
    expect(readGuestProgress().completed['act-vars-read']).toBeDefined()
    expect(submit).not.toHaveBeenCalled()
    await expectNoSeriousA11yViolations(container)
  })
})

describe('B4 self-register', () => {
  async function register(name: string) {
    await userEvent.type(screen.getByLabelText('Display name'), name)
    await userEvent.click(screen.getByRole('button', { name: 'Save my progress' }))
  }

  it('registers once, shows the code with a link to sign in, and keeps device progress for the merge', async () => {
    markGuestCompleted('act-vars-video')
    const api = mockApi()
    const registerSpy = vi.spyOn(api, 'selfRegister')
    const { container } = renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText('GREEN-OWL-41')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with this code' })).toHaveAttribute('href', '/sign-in')
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(readGuestProgress().completed['act-vars-video']).toBeDefined()
    await expectNoSeriousA11yViolations(container)
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
