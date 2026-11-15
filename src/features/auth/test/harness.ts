// Test helpers for the auth feature (plain .ts with createElement, so no JSX lint rules apply).
import { createElement as h, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from 'react-router'
import axe from 'axe-core'
import { expect, vi } from 'vitest'

type Row = Record<string, unknown>
export type RpcResult = { data?: unknown; error?: unknown }

export const ME = (role: string, extra: Row = {}) => ({
  profile_id: '11111111-1111-4111-8111-111111111111', role, can_author: false,
  display_name: 'Pat', class_id: null, class_name: null, ...extra,
})

/** A stand-in for the Supabase client: the auth calls the app makes, and rpc() with canned answers. */
export function fakeSupabase(init: {
  session?: boolean
  anonError?: unknown
  user?: Row | null
  rpc?: Record<string, (args: Row) => RpcResult>
} = {}) {
  let hasSession = init.session ?? false
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: hasSession ? { access_token: 't' } : null } })),
    signInAnonymously: vi.fn(async () => {
      if (init.anonError) return { data: {}, error: init.anonError }
      hasSession = true
      return { data: {}, error: null }
    }),
    signOut: vi.fn(async () => { hasSession = false; return { error: null } }),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    getUser: vi.fn(async () => ({ data: { user: init.user ?? null } })),
  }
  const rpc = vi.fn((fn: string, args: Row = {}) => {
    const run = async () => ({ error: null, status: 200, ...(init.rpc?.[fn]?.(args) ?? { data: null }) })
    const chain = {
      setHeader: () => chain,
      abortSignal: () => chain,
      then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => run().then(ok, bad),
    }
    return chain
  })
  return { auth, rpc }
}

function Where() {
  return h('p', { 'data-testid': 'location' }, useLocation().pathname)
}

/** Render `element` at `path`, with a fresh query cache. Any other URL shows its path in `location`. */
export function renderAt(element: ReactElement, { path, url, extra = [] }: { path: string; url: string; extra?: RouteObject[] }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const router = createMemoryRouter([{ path, element }, ...extra, { path: '*', element: h(Where) }], { initialEntries: [url] })
  return { queryClient, ...render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router }))) }
}

/** 0 serious or critical axe violations. Contrast is skipped (jsdom has no layout); Lighthouse covers it. */
export async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { iframes: false, rules: { 'color-contrast': { enabled: false } } })
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}
