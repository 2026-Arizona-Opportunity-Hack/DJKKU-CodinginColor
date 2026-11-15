import { lazy, Suspense } from 'react'

import { importWithReload } from '@/lib/chunkReload'

import { PageSkeleton } from './components/states'

// Code-split: the player (and its data layer) loads on the first visit to /learn.
// If the code file is gone (new deploy, restarted dev server), reload once to get the current one.
const PlayerApp = lazy(importWithReload(() => import('./PlayerApp')))

export function PlayerEntry() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlayerApp />
    </Suspense>
  )
}
