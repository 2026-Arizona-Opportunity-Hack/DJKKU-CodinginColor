import type { FeatureModule } from '@/lib/feature'
import { instructorGuide } from './guide'
import { lazyPage } from '@/lib/lazyPage'

const InstructorPage = lazyPage(() => import('./InstructorPage'), 'InstructorPage')

// Lane D (M7): instructor dashboard, per-student progress, stuck and not-started lists.
export const instructor: FeatureModule = {
  id: 'instructor',
  label: 'Instructor',
  path: '/instructor',
  routes: [{ path: '/instructor/*', element: <InstructorPage /> }],
  roles: ['instructor', 'cic_admin', 'mentor'],
  guide: instructorGuide,
}
