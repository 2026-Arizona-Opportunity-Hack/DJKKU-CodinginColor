import type { FeatureModule } from '@/lib/feature'
import { SignInPage } from './SignInPage'

// Student sign-in, self-registration and guest access.
export const auth: FeatureModule = {
  id: 'auth',
  label: 'Sign in',
  path: '/sign-in',
  routes: [{ path: '/sign-in', element: <SignInPage /> }],
}
