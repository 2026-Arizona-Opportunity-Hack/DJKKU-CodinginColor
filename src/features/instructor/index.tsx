import type { FeatureModule } from '@/lib/feature'
import { InstructorPage } from './InstructorPage'

// Lane D (M7): instructor dashboard, per-student progress, stuck and not-started lists.
export const instructor: FeatureModule = {
  id: 'instructor',
  label: 'Instructor',
  path: '/instructor',
  routes: [{ path: '/instructor/*', element: <InstructorPage /> }],
  roles: ['instructor', 'mentor', 'admin'],
}
