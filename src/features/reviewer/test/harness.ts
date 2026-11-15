// Test helpers for the reviewer feature (plain .ts with createElement, so no JSX lint rules apply).
// Features may not import each other, so these are this feature's own copies of the pattern.
import { createElement as h, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import axe from 'axe-core'
import { expect, vi } from 'vitest'

type Answer = { data?: unknown; error?: unknown }

/**
 * A stand-in for the Supabase client's `from(table).select(...).eq(...)` calls. `tables` gives
 * the canned answer per table, and `calls` records every table asked for, with its filters.
 */
export function fakeSupabase(tables: Record<string, Answer | (() => Answer)>) {
  const calls: { table: string; select: string; filters: [string, unknown][] }[] = []
  const from = vi.fn((table: string) => {
    const call = { table, select: '', filters: [] as [string, unknown][] }
    calls.push(call)
    const answer = (): Answer => {
      const t = tables[table]
      return { data: null, error: null, ...(typeof t === 'function' ? t() : (t ?? {})) }
    }
    const builder = {
      select: (s: string) => ((call.select = s), builder),
      eq: (column: string, value: unknown) => (call.filters.push([column, value]), builder),
      order: () => builder,
      maybeSingle: async () => {
        const a = answer()
        return { ...a, data: Array.isArray(a.data) ? (a.data[0] ?? null) : a.data }
      },
      then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad),
    }
    return builder
  })
  return { from, calls }
}

function Where() {
  return h('p', { 'data-testid': 'location' }, useLocation().pathname)
}

/** Render `element` at `path` with a fresh query cache and no retries. */
export function renderAt(element: ReactElement, { path, url }: { path: string; url: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const router = createMemoryRouter([{ path, element }, { path: '*', element: h(Where) }], { initialEntries: [url] })
  return { queryClient, ...render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router }))) }
}

/** 0 serious or critical axe violations. Contrast is skipped (jsdom has no layout); Lighthouse covers it. */
export async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { iframes: false, rules: { 'color-contrast': { enabled: false } } })
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}
