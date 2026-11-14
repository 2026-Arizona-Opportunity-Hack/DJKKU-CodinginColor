// @vitest-environment jsdom
import '../test/setup'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/player/errors'
import { expectNoSeriousA11yViolations, mockApi, renderRoute } from '@/features/player/test/render'

import { JoinPage } from '../pages/JoinPage'
import { StartPage } from '../pages/StartPage'

describe('B1 login code', () => {
  it('signs in with a valid code, stays signed in, and lands on Start here', async () => {
    const api = mockApi()
    renderRoute(<StartPage />, { path: '/start', url: '/start', api })
    await userEvent.type(screen.getByLabelText('Login code'), 'blue-fox-27')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn')
    expect(await api.getMe()).toMatchObject({ display_name: 'Maya R.' })
  })

  it('pre-fills the code from a QR link (/c/:code)', async () => {
    renderRoute(<StartPage />, { path: '/c/:code', url: '/c/BLUE-FOX-27' })
    expect(screen.getByLabelText('Login code')).toHaveValue('BLUE-FOX-27')
  })

  it('shows an inline error for a bad code, without crashing', async () => {
    renderRoute(<StartPage />, { path: '/start', url: '/start' })
    const input = screen.getByLabelText('Login code')
    await userEvent.type(input, 'NOPE-0000')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/didn't work/)).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue('NOPE-0000')
  })

  it('validates the format on the client before calling the server', async () => {
    const api = mockApi()
    const spy = vi.spyOn(api, 'claimLoginCode')
    renderRoute(<StartPage />, { path: '/start', url: '/start', api })
    await userEvent.type(screen.getByLabelText('Login code'), 'ab<cd')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/only letters, numbers and dashes/)).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a network error with a reference', async () => {
    const api = mockApi()
    vi.spyOn(api, 'claimLoginCode').mockRejectedValue(new ApiError('offline', { requestId: 'abcdef12-0000' }))
    renderRoute(<StartPage />, { path: '/start', url: '/start', api })
    await userEvent.type(screen.getByLabelText('Login code'), 'BLUE-FOX-27')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument()
    expect(screen.getByText(/Reference: abcdef12/)).toBeInTheDocument()
  })

  it('has no serious accessibility violations', async () => {
    const { container } = renderRoute(<StartPage />, { path: '/start', url: '/start' })
    await expectNoSeriousA11yViolations(container)
  })
})

describe('B2 join link', () => {
  it('lists unclaimed names and signs in after picking one', async () => {
    const api = mockApi()
    renderRoute(<JoinPage />, { path: '/join/:joinCode', url: '/join/SAT-CODERS', api })
    await userEvent.click(await screen.findByRole('button', { name: "I'm Ava K." }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn')
    expect(await api.listJoinRoster('SAT-CODERS')).not.toContainEqual(expect.objectContaining({ label: 'Ava K.' }))
  })

  it('shows an error for a bad join code', async () => {
    renderRoute(<JoinPage />, { path: '/join/:joinCode', url: '/join/WRONG' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't work/)
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('shows a network error with a reference and keeps the list', async () => {
    const api = mockApi()
    vi.spyOn(api, 'claimRosterSeat').mockRejectedValue(new ApiError('unavailable', { requestId: '12345678-x' }))
    renderRoute(<JoinPage />, { path: '/join/:joinCode', url: '/join/SAT-CODERS', api })
    await userEvent.click(await screen.findByRole('button', { name: "I'm Jordan T." }))
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument()
    expect(screen.getByText(/Reference: 12345678/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I'm Jordan T." })).toBeInTheDocument()
  })

  it('shows the empty state when every seat is claimed', async () => {
    const api = mockApi({ claimedSeats: ['m-jordan', 'm-ava', 'm-luis'] })
    const { container } = renderRoute(<JoinPage />, { path: '/join/:joinCode', url: '/join/SAT-CODERS', api })
    expect(await screen.findByText('Everyone on this list has signed in')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })
})
