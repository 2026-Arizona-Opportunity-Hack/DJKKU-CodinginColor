import { lazy, Suspense } from 'react'

import { PageSkeleton } from './components/states'

// Code-split: the player (and its data layer) loads on the first visit to /learn.
const PlayerApp = lazy(() => import('./PlayerApp'))

export function PlayerEntry() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlayerApp />
    </Suspense>
  )
}
