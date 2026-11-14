import type { FeatureModule } from '@/lib/feature'
import { AuthoringPage } from './AuthoringPage'

// Lane C (M3, M5): authoring studio, test builder, learning gain screens.
export const authoring: FeatureModule = {
  id: 'authoring',
  label: 'Author',
  path: '/author',
  routes: [{ path: '/author/*', element: <AuthoringPage /> }],
  roles: ['instructor', 'admin'],
}
