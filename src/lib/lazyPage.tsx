import { lazy, Suspense, type ComponentType } from 'react'

import { importWithReload } from '@/lib/chunkReload'

/**
 * Code-splits a feature's page: its code (and heavy libraries such as react-markdown or
 * react-hook-form) downloads on the first visit to that page instead of with every page.
 * A student opening /learn no longer downloads the staff screens. Measured on the mock build:
 * see docs/progress.md, 2026-11-14 design pass.
 *
 *   const AdminPage = lazyPage(() => import('./AdminPage'), 'AdminPage')
 *   routes: [{ path: '/admin/*', element: <AdminPage /> }]
 */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M & string>(
  load: () => Promise<M>,
  exportName: K,
): ComponentType {
  // Stale code after a deploy: reload once instead of showing an error (see chunkReload.ts).
  const safeLoad = importWithReload(load)
  const Page = lazy(async () => ({ default: (await safeLoad())[exportName] as ComponentType }))
  function LazyPage() {
    return (
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading…</p>}>
        <Page />
      </Suspense>
    )
  }
  LazyPage.displayName = `Lazy(${exportName})`
  return LazyPage
}
