import type { GuideEntry } from '@/lib/feature'

// /instructor/go/<section> opens the section in your first class (or the create form if you have none).
export const instructorGuide: GuideEntry[] = [
  { id: 'create-class', title: 'Create a class', summary: 'Name the class and pick its school. Takes a minute.', to: '/instructor/new', roles: ['instructor', 'cic_admin'], group: 'Set up a class', step: 1 },
  { id: 'join-code', title: 'Share the join link or QR code', summary: 'Students open it and pick their name. Make a new one after class to stop the old one.', to: '/instructor/go/join-code', roles: ['instructor', 'cic_admin'], group: 'Set up a class', step: 2 },
  { id: 'roster', title: 'Import your roster and print login codes', summary: 'Paste names (first name and last initial), then print a sheet of personal codes.', to: '/instructor/go/roster', roles: ['instructor', 'cic_admin'], group: 'Set up a class', step: 3 },
  { id: 'assign', title: 'Assign modules', summary: 'Choose which published modules the class takes, in order, and when they open.', to: '/instructor/go/assign', roles: ['instructor', 'cic_admin'], group: 'Set up a class', step: 4 },
  { id: 'starting-point', title: 'Start a late joiner at a later module', summary: 'Place a student who joins mid-course at the right module.', to: '/instructor/go/starting-point', roles: ['instructor', 'cic_admin'], group: 'Set up a class' },
  { id: 'dashboard', title: 'Class dashboard', summary: 'Who is stuck, who has not started, progress and learning gain for each student.', to: '/instructor/go/dashboard', roles: ['instructor', 'cic_admin'], group: 'Run a class', step: 5 },
  { id: 'live', title: 'Live class view', summary: 'A projector-friendly grid of every student and activity, refreshed every 20 seconds.', to: '/instructor/go/live', roles: ['instructor', 'cic_admin'], group: 'Run a class' },
  { id: 'reteach', title: 'What to reteach', summary: 'The questions most students got wrong first, and the wrong answers they gave.', to: '/instructor/go/reteach', roles: ['instructor', 'cic_admin'], group: 'Run a class' },
  { id: 'student-report', title: 'One student in depth, and a note home', summary: "A student's progress, mistakes and next steps, plus a positive note for their family.", to: '/instructor/go/dashboard', roles: ['instructor', 'cic_admin'], group: 'Run a class', howTo: "Click a student's name in the class dashboard." },
  { id: 'impact-report', title: 'Impact report for funders', summary: 'A one-page, printable learning-gain report for the class.', to: '/instructor/go/report', roles: ['instructor', 'cic_admin'], group: 'Report' },
]
