// @vitest-environment jsdom
import '../test/setup'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoSeriousA11yViolations, fakeSupabase, ME, renderAt } from '../test/harness'
import { SignInPage } from '../SignInPage'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const CLAIMED = { class_id: 'c1', class_name: 'Demo Period 1', display_name: 'Demo S.' }
const LOGIN = 'DEMO-0000-0000-0001'
const show = (sb: ReturnType<typeof fakeSupabase>) => { h.sb = sb }
const open = (url = '/sign-in') => renderAt(<SignInPage />, { path: '/sign-in', url })
const typeCode = async (value: string) => {
  await userEvent.type(screen.getByLabelText('Your login code'), value)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321'))

describe('student login code', () => {
  it('signs in anonymously only when there is no session, claims the typed code, and goes to /learn', async () => {
    const sb = fakeSupabase({ rpc: { claim_login_code: () => ({ data: CLAIMED }) } })
    show(sb)
    open()
    await typeCode('demo-0000-0000-0001')
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn')
    expect(sb.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(sb.rpc).toHaveBeenCalledWith('claim_login_code', { p_code: 'demo-0000-0000-0001' })
  })

  it('reuses an existing session instead of signing in again', async () => {
    const sb = fakeSupabase({ session: true, rpc: { claim_login_code: () => ({ data: CLAIMED }), get_me: () => ({ data: ME('student') }) } })
    show(sb)
    open()
    await typeCode(LOGIN)
    expect(await screen.findByTestId('location')).toHaveTextContent('/learn')
    expect(sb.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('pre-fills the code from ?code= without submitting it, then takes it out of the URL', async () => {
    const sb = fakeSupabase()
    show(sb)
    const { router } = open(`/sign-in?code=${LOGIN}`)
    expect(screen.getByLabelText('Your login code')).toHaveValue(LOGIN)
    expect(sb.rpc).not.toHaveBeenCalledWith('claim_login_code', expect.anything())
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(screen.getByLabelText('Your login code')).toHaveValue(LOGIN)
  })

  it('shows a friendly message for a wrong code and keeps the session (no sign out)', async () => {
    const sb = fakeSupabase({ rpc: { claim_login_code: () => ({ error: { code: 'P0001', message: 'That login code is not valid. Ask your instructor for a new one.' } }) } })
    show(sb)
    open()
    await typeCode(LOGIN)
    expect(await screen.findByText("That code didn't work. Check it with your instructor.")).toBeInTheDocument()
    expect(sb.auth.signOut).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Your login code')).toHaveValue(LOGIN)
    // a second try reuses the anonymous session made by the first
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(sb.rpc).toHaveBeenCalledTimes(2))
    expect(sb.auth.signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('explains a 429 from anonymous sign-in', async () => {
    show(fakeSupabase({ anonError: { status: 429, code: 'over_request_rate_limit', message: 'rate limit' } }))
    open()
    await typeCode(LOGIN)
    expect(await screen.findByText(/Too many sign-ins from this network right now/)).toBeInTheDocument()
  })

  it('sends a 12-character code to the join page and rejects other lengths', async () => {
    const sb = fakeSupabase()
    show(sb)
    open()
    await typeCode('demo join 1234')
    expect(await screen.findByTestId('location')).toHaveTextContent('/join/DEMO-JOIN-1234')
    expect(sb.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('says a code of the wrong length is too short or too long', async () => {
    show(fakeSupabase())
    open()
    await typeCode('ABCD-1234')
    expect(await screen.findByText('That code looks too short or too long.')).toBeInTheDocument()
  })

  it('shows the signed-in student who they are, with Continue and Sign out', async () => {
    const sb = fakeSupabase({ session: true, rpc: { get_me: () => ({ data: ME('student', { display_name: 'Maya R.', class_id: 'c1', class_name: 'Period 1' }) }) } })
    show(sb)
    open()
    expect(await screen.findByText(/Maya R\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/learn')
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(sb.auth.signOut).toHaveBeenCalledTimes(1)
  })
})

describe('staff sign in with Google', () => {
  it('starts Google sign-in and comes back to /sign-in', async () => {
    const sb = fakeSupabase()
    show(sb)
    open()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(sb.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/sign-in` } })
  })

  it('sends staff to their home page after they come back', async () => {
    show(fakeSupabase({ session: true, rpc: { get_me: () => ({ data: ME('cic_admin') }) } }))
    open()
    expect(await screen.findByTestId('location')).toHaveTextContent('/admin')
  })

  it('tells an uninvited Google account to ask an admin, then signs out', async () => {
    const sb = fakeSupabase({ session: true, user: { email: 'new@school.org', is_anonymous: false }, rpc: { get_me: () => ({ data: ME('student') }) } })
    show(sb)
    open()
    expect(await screen.findByText(/hasn't been invited yet. Ask a CIC admin to invite new@school.org/)).toBeInTheDocument()
    await waitFor(() => expect(sb.auth.signOut).toHaveBeenCalledTimes(1))
  })

  it('tells a mentor account there are no mentor screens yet, and signs out instead of opening a page they cannot use', async () => {
    const sb = fakeSupabase({ session: true, user: { email: 'mentor@school.org', is_anonymous: false }, rpc: { get_me: () => ({ data: ME('mentor') }) } })
    show(sb)
    open()
    expect(await screen.findByText(/Mentor accounts don't have screens in this version. Ask a CIC admin to give mentor@school.org another/)).toBeInTheDocument()
    await waitFor(() => expect(sb.auth.signOut).toHaveBeenCalled())
    expect(screen.queryByTestId('location')).not.toBeInTheDocument() // stayed on /sign-in, never sent to /instructor
  })

  it('does not sign out an anonymous student who has not claimed a seat yet', async () => {
    const sb = fakeSupabase({ session: true, user: { email: null, is_anonymous: true }, rpc: { get_me: () => ({ data: ME('student') }) } })
    show(sb)
    open()
    await waitFor(() => expect(sb.auth.getUser).toHaveBeenCalled())
    expect(sb.auth.signOut).not.toHaveBeenCalled()
  })
})

describe('demo mode and accessibility', () => {
  it('turns sign-in off and says why when no database is configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    show(fakeSupabase())
    open()
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled()
  })

  it('has one h1, labelled input and no serious axe violations', async () => {
    show(fakeSupabase())
    const { container } = open()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await expectNoSeriousA11yViolations(container)
  })
})
