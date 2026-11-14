import type { FeatureModule } from '@/lib/feature'
import { PlayerPage } from './PlayerPage'

// Lane B (M4): the student player, unlock flow, late-joiner "start here", mobile.
export const player: FeatureModule = {
  id: 'player',
  label: 'Learn',
  path: '/learn',
  routes: [{ path: '/learn/*', element: <PlayerPage /> }],
}
