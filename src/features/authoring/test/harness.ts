// Test helpers for the authoring studio (plain .ts with createElement, so no JSX lint rules apply).
import '@testing-library/jest-dom/vitest'
import { createElement as h, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider, useLocation, type RouteObject } from 'react-router'
import axe from 'axe-core'
import { afterEach, expect, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

function Where() {
  return h('div', null, h('p', { 'data-testid': 'location' }, useLocation().pathname), h(Link, { to: '/elsewhere' }, 'Leave'))
}

/** Render `element` at `path` with a fresh query cache. Any other URL shows its path in `location`. */
export function renderAt(element: ReactElement, { path = '/author/*', url = '/author', extra = [] }: { path?: string; url?: string; extra?: RouteObject[] } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' }, mutations: { networkMode: 'always' } } })
  const router = createMemoryRouter([{ path, element }, ...extra, { path: '*', element: h(Where) }], { initialEntries: [url] })
  return { queryClient, router, ...render(h(QueryClientProvider, { client: queryClient }, h(RouterProvider, { router }))) }
}

/** 0 serious or critical axe violations. Contrast is skipped (jsdom has no layout); Lighthouse covers it. */
export async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { iframes: false, rules: { 'color-contrast': { enabled: false } } })
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}
