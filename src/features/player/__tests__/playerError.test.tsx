// @vitest-environment jsdom
// The /learn crash screen: a stale-code failure (new deploy, stopped dev server) says what fixes
// it; any other crash keeps the generic message. Both log once with the cause.
import '../test/setup'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { log } from '@/lib/log'

import { PlayerError } from '../PlayerError'

function renderCrash(error: Error) {
  const Boom = () => {
    throw error
  }
  const router = createMemoryRouter(
    [{ path: '/learn/*', element: <Boom />, errorElement: <PlayerError /> }, { path: '/learn', element: <p>home</p> }],
    { initialEntries: ['/learn/explore'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('PlayerError', () => {
  it('explains stale code (the app changed while the tab was open) and logs it as such', async () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React and the router report the throw too
    renderCrash(new TypeError('Failed to fetch dynamically imported module: http://localhost:5173/src/features/player/PlayerApp.tsx'))
    expect(await screen.findByText('This page needs a fresh copy')).toBeInTheDocument()
    expect(screen.getByText(/updated or lost its connection/)).toBeInTheDocument()
    expect(screen.queryByText('Something broke on this page')).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('app.route_error', expect.objectContaining({ stale_code: true }))
  })

  it('keeps the generic message for a real crash', async () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCrash(new Error('useStudentApi must be used inside <StudentApiProvider>'))
    expect(await screen.findByText('Something broke on this page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Start here' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('app.route_error', expect.objectContaining({ stale_code: false }))
  })
})
