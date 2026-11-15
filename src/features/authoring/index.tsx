import type { FeatureModule } from '@/lib/feature'
import { authoringGuide } from './guide'
import { lazyPage } from '@/lib/lazyPage'

const AuthoringPage = lazyPage(() => import('./AuthoringPage'), 'AuthoringPage')

// Lane C (M3, M5): authoring studio, test builder, learning gain screens.
export const authoring: FeatureModule = {
  id: 'authoring',
  label: 'Author',
  path: '/author',
  routes: [{ path: '/author/*', element: <AuthoringPage /> }],
  roles: ['instructor', 'cic_admin'],
  needsAuthorFlag: true,
  guide: authoringGuide,
}
