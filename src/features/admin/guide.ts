import type { GuideEntry } from '@/lib/feature'

export const adminGuide: GuideEntry[] = [
  { id: 'publish-queue', title: 'Publish queue', summary: 'Modules waiting for review: read, publish or send back to the author.', to: '/admin/publish', roles: ['cic_admin'], group: 'Curriculum', step: 1 },
  { id: 'overview', title: 'Overview', summary: 'Every class, its instructors, students and progress at a glance.', to: '/admin/overview', roles: ['cic_admin'], group: 'Programs', step: 2 },
  { id: 'staff', title: 'Invite staff and set roles', summary: 'Invite instructors, reviewers and admins by Google email, and let instructors author modules.', to: '/admin/staff', roles: ['cic_admin'], group: 'People', step: 3 },
  { id: 'api-keys', title: 'API keys for reporting', summary: 'Keys for CIC systems to read class-level progress and learning gain (groups of 5 or more only).', to: '/admin/keys', roles: ['cic_admin'], group: 'Reporting' },
  { id: 'api-docs', title: 'Read API documentation', summary: 'Every endpoint of the reporting API, with examples.', to: '/api/docs/', external: true, roles: ['cic_admin'], group: 'Reporting' },
]
