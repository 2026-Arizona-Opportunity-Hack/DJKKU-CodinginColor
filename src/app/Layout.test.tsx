// @vitest-environment jsdom
import '@/features/auth/test/setup'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase, ME, renderAt } from '@/features/auth/test/harness'
import { Layout } from './Layout'

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))

const open = (role: string | null, url = '/', extra: Record<string, unknown> = {}) => {
  h.sb = fakeSupabase({ session: role !== null, rpc: { get_me: () => ({ data: role ? ME(role, extra) : null }) } })
  return renderAt(<Layout />, { path: '/', url, extra: [{ path: '/*', element: <Layout /> }] })
}
const nav = () => screen.getByRole('navigation', { name: 'Main' })

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321'))

describe('page frame', () => {
  it('sets the tab title from the route and shows the app name as the home link', async () => {
    open('student', '/learn/c1/progress', { class_id: 'c1', class_name: 'P1' })
    expect(await screen.findByRole('link', { name: 'Coding in Color Learn, home' })).toHaveAttribute('href', '/')
    expect(document.title).toBe('My progress | Coding in Color Learn')
  })

  it('makes every nav link at least 44px tall for thumbs', async () => {
    open(null)
    await screen.findByRole('link', { name: 'Sign in' })
    for (const link of within(nav()).getAllByRole('link')) expect(link.className).toContain('min-h-11')
  })
})

describe('role-aware nav', () => {
  it('hides Admin from a student and shows Learn', async () => {
    open('student', '/', { class_id: 'c1', class_name: 'P1' })
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(nav()).not.toHaveTextContent('Admin')
    expect(nav()).toHaveTextContent('Learn')
    expect(nav()).not.toHaveTextContent('Sign in')
  })

  it('shows Admin, Instructor and Review to a CIC admin', async () => {
    open('cic_admin')
    await screen.findByRole('button', { name: 'Sign out' })
    for (const label of ['Admin', 'Instructor', 'Review', 'Author']) expect(nav()).toHaveTextContent(label)
  })

  it('shows Learn and Sign in to a signed-out visitor, and nothing staff-only', async () => {
    open(null)
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(nav()).toHaveTextContent('Learn')
    expect(nav()).not.toHaveTextContent('Admin')
    expect(within(nav()).getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/guide')
  })

  it('shows the name next to Sign out, and signing out calls Supabase', async () => {
    open('instructor')
    expect(await screen.findByText(/Pat/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect((h.sb as ReturnType<typeof fakeSupabase>).auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('stops a student at /admin with a friendly message', async () => {
    open('student', '/admin')
    expect(await screen.findByRole('heading', { name: "You don't have access to this page" })).toBeInTheDocument()
  })

  it('labels demo mode and shows every link', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    open(null)
    expect(nav()).toHaveTextContent('Demo mode')
    expect(nav()).toHaveTextContent('Admin')
  })
})
