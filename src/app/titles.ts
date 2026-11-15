export const APP_NAME = 'Coding in Color Learn'

const RULES: [RegExp, string][] = [
  [/^\/$/, 'Home'],
  [/^\/sign-in/, 'Sign in'],
  [/^\/join\//, 'Join your class'],
  [/^\/learn\/explore\/save/, 'Save my progress'],
  [/^\/learn\/explore\/a\//, 'Free lesson'],
  [/^\/learn\/explore/, 'Free lessons'],
  [/^\/learn\/[^/]+\/progress/, 'My progress'],
  [/^\/learn\/[^/]+\/certificate\//, 'Certificate'],
  [/^\/learn\/[^/]+\/notebook/, 'My notebook'],
  [/^\/learn\/[^/]+\/test\//, 'Test'],
  [/^\/learn\/[^/]+\/a\//, 'Activity'],
  [/^\/learn\/[^/]+/, 'Your path'],
  [/^\/learn/, 'Start here'],
  [/^\/author\/new/, 'New module'],
  [/^\/author\/[^/]+/, 'Edit module'],
  [/^\/author/, 'Authoring studio'],
  [/^\/instructor\/new/, 'New class'],
  [/^\/instructor\/[^/]+\/live/, 'Live class view'],
  [/^\/instructor\/[^/]+\/report/, 'Impact report'],
  [/^\/instructor/, 'Instructor'],
  [/^\/admin\/publish/, 'Admin: publish queue'],
  [/^\/admin\/staff/, 'Admin: staff'],
  [/^\/admin\/classes/, 'Admin: classes'],
  [/^\/admin\/schools/, 'Admin: schools'],
  [/^\/admin\/keys/, 'Admin: API keys'],
  [/^\/admin\/mentors/, 'Admin: mentors'],
  [/^\/admin\/overview/, 'Admin: overview'],
  [/^\/admin/, 'Admin'],
  [/^\/review\/[^/]+/, 'Module review'],
  [/^\/review/, 'Curriculum review'],
]

/** The browser tab and screen reader title for a path: "<page> | Coding in Color Learn". */
export function pageTitle(pathname: string): string {
  const label = RULES.find(([re]) => re.test(pathname))?.[1] ?? 'Page not found'
  return `${label} | ${APP_NAME}`
}
