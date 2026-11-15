// @vitest-environment jsdom
import '@/features/auth/test/setup'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase, ME, renderAt } from '@/features/auth/test/harness'
import { Home } from './Home'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const open = (role: string | null) => {
  h.sb = fakeSupabase({ session: role !== null, rpc: { get_me: () => ({ data: role ? ME(role) : null }) } })
  return renderAt(<Home />, { path: '/', url: '/' })
}

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321'))

describe('home page', () => {
  it('offers three ways in when signed out', async () => {
    open(null)
    expect(await screen.findByRole('link', { name: 'I have a login code' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Browse lessons' })).toHaveAttribute('href', '/learn/explore')
    expect(screen.getByRole('link', { name: 'Staff sign in' })).toHaveAttribute('href', '/sign-in#staff')
  })

  it('sends a signed-in person to their own home', async () => {
    open('reviewer')
    expect(await screen.findByTestId('location')).toHaveTextContent('/review')
  })

  it('shows the landing page, labelled Demo mode, when no database is configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    open(null)
    expect(screen.getByRole('heading', { level: 1, name: 'Coding in Color' })).toBeInTheDocument()
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument()
  })
})
