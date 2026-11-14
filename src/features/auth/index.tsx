import type { FeatureModule } from '@/lib/feature'
import { SignInPage } from './SignInPage'

// M1: login-code entry for students, Google sign-in for staff, reviewers and mentors.
export const auth: FeatureModule = {
  id: 'auth',
  label: 'Sign in',
  path: '/sign-in',
  routes: [{ path: '/sign-in', element: <SignInPage /> }],
}
