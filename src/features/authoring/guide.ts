import type { GuideEntry } from '@/lib/feature'

export const authoringGuide: GuideEntry[] = [
  { id: 'my-modules', title: 'My modules', summary: 'Every module you are writing, with its status: draft, waiting for review or published.', to: '/author', roles: ['author', 'cic_admin'], group: 'Build a module', step: 1 },
  { id: 'new-module', title: 'Start a new module', summary: 'Give it a title, then add lessons and activities.', to: '/author/new', roles: ['author', 'cic_admin'], group: 'Build a module', step: 2 },
  { id: 'find-material', title: 'Find material on YouTube or GitHub', summary: 'Search for videos and open-licensed READMEs and add them as activities.', to: '/author/new', roles: ['author', 'cic_admin'], group: 'Build a module', step: 3, howTo: 'In a lesson, press "Find material".' },
  { id: 'activities', title: 'Add activities', summary: 'Videos, readings, checks, worksheets, exit tickets, Python code activities and Parsons problems.', to: '/author/new', roles: ['author', 'cic_admin'], group: 'Build a module', howTo: 'In a lesson, choose an activity type and press "Add activity". "Add a Coder spotlight" adds a story template.' },
  { id: 'draft-tests', title: 'Draft the pre-test and post-test with AI', summary: "The AI reads the module and writes paired questions for you to check and edit.", to: '/author/new', roles: ['author', 'cic_admin'], group: 'Build a module', step: 4, howTo: 'Below the lessons, in "Pre-test and post-test", press "Draft both tests with AI".' },
  { id: 'preview', title: 'Preview as a student', summary: 'See any activity exactly as a student will, with no answers showing.', to: '/author', roles: ['author', 'cic_admin'], group: 'Build a module', howTo: 'Open a module and press "Preview as student" on an activity.' },
  { id: 'submit', title: 'Submit for review', summary: 'Send a finished draft to a CIC admin to publish.', to: '/author', roles: ['author', 'cic_admin'], group: 'Publish', step: 5, howTo: 'Open the module, save it, then press "Submit for review" at the bottom.' },
  { id: 'new-version', title: 'Change a published module', summary: 'Published versions are locked; make a new version to edit it, then submit again.', to: '/author', roles: ['author', 'cic_admin'], group: 'Publish', howTo: 'Open the published module and press "New version".' },
]
