import type { FeatureModule } from '@/lib/feature'

import { PlayerEntry } from './PlayerEntry'
import { PlayerError } from './PlayerError'

// Lane B (M4 + student side of M1): login code, join link, guest mode, self-register,
// "Start here", module path, activity player, tests, own progress. Every screen lives
// under /learn; the sub-routes are in PlayerApp.tsx.
export const player: FeatureModule = {
  id: 'player',
  label: 'Learn',
  path: '/learn',
  routes: [{ path: '/learn/*', element: <PlayerEntry />, errorElement: <PlayerError /> }],
}
