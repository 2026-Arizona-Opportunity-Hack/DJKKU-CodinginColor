import type { FeatureModule } from '@/lib/feature'
import { lazyPage } from '@/lib/lazyPage'

const JoinPage = lazyPage(() => import('./JoinPage'), 'JoinPage')
const SignInPage = lazyPage(() => import('./SignInPage'), 'SignInPage')

// M1: login code and class join link for students, Google sign-in for staff, mentors and reviewers.
export const auth: FeatureModule = {
  id: 'auth',
  label: 'Sign in',
  path: '/sign-in',
  extraPaths: ['/join'],
  routes: [
    { path: '/sign-in', element: <SignInPage /> },
    { path: '/join/:joinCode', element: <JoinPage /> },
  ],
  showSignedOut: 'only',
}
