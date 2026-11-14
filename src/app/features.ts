import type { FeatureModule } from '@/lib/feature'
import { admin } from '@/features/admin'
import { auth } from '@/features/auth'
import { authoring } from '@/features/authoring'
import { instructor } from '@/features/instructor'
import { player } from '@/features/player'
import { reviewer } from '@/features/reviewer'

/**
 * THE place a new feature is registered. To add one:
 *   1. create src/features/<name>/ with an index.tsx exporting a FeatureModule
 *   2. import it above and add it to this list
 * Order here is the order of the nav bar. features.test.ts checks ids and paths
 * are unique, so a clash fails the tests instead of breaking the app.
 */
export const features: FeatureModule[] = [
  player,
  authoring,
  instructor,
  admin,
  reviewer,
  auth,
]
