import type { GuideEntry } from '@/lib/feature'

export const reviewerGuide: GuideEntry[] = [
  { id: 'review-list', title: 'Published curriculum', summary: 'Every published module, read-only. No student data and no answers.', to: '/review', roles: ['reviewer', 'cic_admin'], group: 'Review', step: 1 },
  { id: 'review-module', title: 'Read a module and its test pairs', summary: 'Lessons as students see them, and each pre-test item beside its post-test twin.', to: '/review', roles: ['reviewer', 'cic_admin'], group: 'Review', step: 2, howTo: 'Open a module from the list.' },
]
