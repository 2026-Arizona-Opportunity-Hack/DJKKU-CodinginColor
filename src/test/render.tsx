import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from 'react-router'
import axe from 'axe-core'
import { expect } from 'vitest'

import type { StudentApi } from '@/features/student/api'
import { createMockApi, type MockState } from '@/features/student/api.mock'
import { StudentApiProvider } from '@/features/student/apiContext'
import { SEED_CLASS } from '@/features/student/mockSeed'

export const MAYA = { display_name: 'Maya R.', class_id: SEED_CLASS.class_id, class_name: SEED_CLASS.class_name }
export const CLASS_ID = SEED_CLASS.class_id

/** Maya, pretest taken, first lesson done: the next step is the loops worksheet. */
export const MID_MODULE: Partial<MockState> = {
  me: MAYA,
  done: ['act-vars-video', 'act-vars-read', 'act-vars-check'],
  assessments: { 'pre-basics': { score_pct: 33 } },
}

export function mockApi(state: Partial<MockState> = {}) {
  return createMockApi({ storage: null, latencyMs: 0, state })
}

/** Shows where the router ended up, for navigation assertions. */
function Where() {
  const loc = useLocation()
  return <p data-testid="location">{loc.pathname}</p>
}

/** Render one route (pattern `path`) at `url`, with a mock API and fresh query cache. */
export function renderRoute(
  element: ReactElement,
  { path, url, api = mockApi(), extra = [] }: { path: string; url: string; api?: StudentApi; extra?: RouteObject[] },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' }, mutations: { networkMode: 'always' } },
  })
  const router = createMemoryRouter(
    [{ path, element }, ...extra, { path: '*', element: <Where /> }],
    { initialEntries: [url] },
  )
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <StudentApiProvider value={api}>
        <RouterProvider router={router} />
      </StudentApiProvider>
    </QueryClientProvider>,
  )
  return { ...utils, api, router, queryClient }
}

/** B12: 0 serious/critical axe violations. Contrast is skipped (jsdom has no layout); Lighthouse covers it. */
export async function expectNoSeriousA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { iframes: false, rules: { 'color-contrast': { enabled: false } } })
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([])
}
