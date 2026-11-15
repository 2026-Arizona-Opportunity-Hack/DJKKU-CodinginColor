// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

const { client } = vi.hoisted(() => ({
  client: {
    auth: {
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({ getSupabase: () => client }))

import { SignInPage } from './SignInPage'

const CLASS_ID = '10000000-0000-4000-8000-000000000001'

afterEach(cleanup)

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/learn/:classId" element={<p>Class home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  client.auth.signInAnonymously.mockResolvedValue({
    data: { session: { user: { id: 'student-id' } } },
    error: null,
  })
  client.auth.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: 'https://accounts.google.com/' },
    error: null,
  })
})

describe('student sign-in', () => {
  it('claims a personal login code and opens its class', async () => {
    client.rpc.mockResolvedValue({ data: { class_id: CLASS_ID }, error: null })
    renderSignIn()
    await userEvent.type(screen.getByLabelText('Personal login code'), 'DEMO-0000-0000-0001')
    await userEvent.click(screen.getByRole('button', { name: /sign in to learn/i }))

    expect(await screen.findByText('Class home')).toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('claim_login_code', { p_code: 'DEMO-0000-0000-0001' })
  })

  it('creates a name-only account, reveals its one-time code, and continues to CIC Open', async () => {
    client.rpc.mockResolvedValue({ data: { class_id: CLASS_ID, login_code: 'ABCD-EFGH-IJKL-MNOP' }, error: null })
    renderSignIn()
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam P.')
    await userEvent.click(screen.getByRole('button', { name: /create my account/i }))

    expect(await screen.findByText('ABCD-EFGH-IJKL-MNOP')).toBeInTheDocument()
    expect(client.auth.signInAnonymously).toHaveBeenCalledWith({ options: { data: { display_name: 'Sam P.' } } })
    expect(client.rpc).toHaveBeenCalledWith('self_register', { p_display_name: 'Sam P.' })
    await userEvent.click(screen.getByRole('button', { name: /continue to lessons/i }))
    expect(await screen.findByText('Class home')).toBeInTheDocument()
  })

  it('lets account creation claim an optional roster login code', async () => {
    client.rpc.mockResolvedValue({ data: { class_id: CLASS_ID }, error: null })
    renderSignIn()
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam P.')
    await userEvent.type(screen.getByLabelText(/Personal login code/), 'DEMO-0000-0000-0001')
    await userEvent.click(screen.getByRole('button', { name: /create my account/i }))

    expect(await screen.findByText('Class home')).toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('claim_login_code', { p_code: 'DEMO-0000-0000-0001' })
    expect(client.rpc).not.toHaveBeenCalledWith('self_register', expect.anything())
  })

  it('does not send an email address as a display name', async () => {
    renderSignIn()
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'sam@example.com')
    await userEvent.click(screen.getByRole('button', { name: /create my account/i }))

    expect(await screen.findByText('Leave out email addresses.')).toBeInTheDocument()
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('starts a guest session and opens CIC Open', async () => {
    client.rpc.mockResolvedValue({ data: [{ class_id: CLASS_ID, display_name: 'Guest' }], error: null })
    renderSignIn()
    await userEvent.click(screen.getByRole('button', { name: /continue as guest/i }))

    expect(await screen.findByText('Class home')).toBeInTheDocument()
    expect(client.rpc).toHaveBeenCalledWith('guest_sign_in', { p_display_name: 'Guest' })
  })

  it('starts staff Google OAuth and returns to the sign-in callback', async () => {
    renderSignIn()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringMatching(/\/sign-in$/) },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/opening google sign-in/i)
  })

  it('shows backend errors without clearing the entered code', async () => {
    client.rpc.mockResolvedValue({ data: null, error: new Error('That login code is not valid') })
    renderSignIn()
    const code = screen.getByLabelText('Personal login code')
    await userEvent.type(code, 'DEMO-0000-0000-0001')
    await userEvent.click(screen.getByRole('button', { name: /sign in to learn/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/login code was not recognized/i)
    expect(code).toHaveValue('DEMO-0000-0000-0001')
  })
})
