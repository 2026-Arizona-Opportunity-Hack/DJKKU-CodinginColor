import type { FeatureModule } from '@/lib/feature'
import { AdminPage } from './AdminPage'

// Lane D (M2, M8): class and roster setup (CSV import), admin console, API keys, reviewer invites.
export const admin: FeatureModule = {
  id: 'admin',
  label: 'Admin',
  path: '/admin',
  routes: [{ path: '/admin/*', element: <AdminPage /> }],
  roles: ['instructor', 'admin'],
}
