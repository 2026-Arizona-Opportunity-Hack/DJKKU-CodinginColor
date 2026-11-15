import type { FeatureModule } from '@/lib/feature'
import { ReviewerPage } from './ReviewerPage'

// Lane E (M9): read-only curriculum browser for external reviewers. No answer keys, no student data.
export const reviewer: FeatureModule = {
  id: 'reviewer',
  label: 'Review',
  path: '/review',
  routes: [{ path: '/review/*', element: <ReviewerPage /> }],
  roles: ['reviewer', 'cic_admin'],
}
