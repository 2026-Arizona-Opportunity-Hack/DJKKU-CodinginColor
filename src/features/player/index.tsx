import type { FeatureModule } from '@/lib/feature'
import { playerGuide } from './guide'

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
  roles: ['student', 'independent_student'],
  showSignedOut: 'also', // guests can browse lessons without an account
  guide: playerGuide,
}
