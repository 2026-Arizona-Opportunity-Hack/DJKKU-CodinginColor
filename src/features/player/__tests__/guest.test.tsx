// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/player/errors'
import { GUEST_STORAGE_KEY, markGuestCompleted, readGuestProgress } from '@/features/player/guestProgress'
import { log } from '@/lib/log'
import { expectNoSeriousA11yViolations, mockApi, renderRoute } from '@/features/player/test/render'

import { ExplorePage } from '../pages/ExplorePage'
import { GuestActivityPage } from '../pages/GuestActivityPage'
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

  it('registers, shows the code once, signs in and merges device progress exactly once', async () => {
    markGuestCompleted('act-vars-video')
    const api = mockApi()
    const importSpy = vi.spyOn(api, 'importGuestProgress')
    const { container } = renderRoute(<SaveProgressPage />, { path: '/explore/save', url: '/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText(/GREEN-OWL-41/)).toBeInTheDocument()
    expect(screen.getByText(/Write this down or print it/)).toBeInTheDocument()
    expect(screen.getByText(/copied 1 finished activity/)).toBeInTheDocument()
    expect(importSpy).toHaveBeenCalledTimes(1)
    expect(await api.getMe()).toMatchObject({ display_name: 'Sam P.' })
    expect(readGuestProgress().completed).toEqual({}) // merged, so cleared from the device
    await expectNoSeriousA11yViolations(container)
  })

  it('rejects emails and links on the client', async () => {
    const api = mockApi()
    const spy = vi.spyOn(api, 'selfRegister')
    renderRoute(<SaveProgressPage />, { path: '/explore/save', url: '/explore/save', api })
    await register('sam@example.com')
    expect(await screen.findByText('Leave out email addresses.')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveAttribute('aria-invalid', 'true')
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a friendly message on 429 and does not merge', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = mockApi()
    vi.spyOn(api, 'selfRegister').mockRejectedValue(new ApiError('rate_limited', { status: 429, requestId: 'ratelimit-1' }))
    const importSpy = vi.spyOn(api, 'importGuestProgress')
    renderRoute(<SaveProgressPage />, { path: '/explore/save', url: '/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText(/Too many tries right now/)).toBeInTheDocument()
    expect(importSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Display name')).toHaveValue('Sam P.')
  })

  it('still shows the code if only the merge fails, and keeps device progress', async () => {
    const logged = vi.spyOn(log, 'error').mockImplementation(() => {})
    markGuestCompleted('act-vars-video')
    const api = mockApi()
    vi.spyOn(api, 'importGuestProgress').mockRejectedValue(new ApiError('unavailable', { requestId: 'imp-1' }))
    renderRoute(<SaveProgressPage />, { path: '/explore/save', url: '/explore/save', api })
    await register('Sam P.')
    expect(await screen.findByText(/GREEN-OWL-41/)).toBeInTheDocument()
    expect(screen.getByText(/didn't copy over/)).toBeInTheDocument()
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

  it('keeps and shows the new code when sign-in fails, and a retry re-uses it (no second account)', async () => {
    vi.spyOn(log, 'error').mockImplementation(() => {})
    const api = mockApi()
    const register = vi.spyOn(api, 'selfRegister')
    const claim = vi.spyOn(api, 'claimLoginCode').mockRejectedValueOnce(new ApiError('unavailable', { requestId: 'claim-1' }))
    renderRoute(<SaveProgressPage />, { path: '/learn/explore/save', url: '/learn/explore/save', api })
    await userEvent.type(screen.getByLabelText('Display name'), 'Sam P.')
    await userEvent.click(screen.getByRole('button', { name: 'Save my progress' }))
    expect(await screen.findByText('GREEN-OWL-41')).toBeInTheDocument()
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try signing in again' }))
    expect(await screen.findByText('Your progress is saved')).toBeInTheDocument()
    expect(register).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledTimes(2)
    expect(claim).toHaveBeenLastCalledWith('GREEN-OWL-41')
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
