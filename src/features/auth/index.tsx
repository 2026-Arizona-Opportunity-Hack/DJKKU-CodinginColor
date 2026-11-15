import type { FeatureModule } from '@/lib/feature'
import { JoinPage } from './JoinPage'
import { SignInPage } from './SignInPage'

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
