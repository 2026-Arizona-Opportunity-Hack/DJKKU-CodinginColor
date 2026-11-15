import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import type { Role } from '@shared/roles'
import { useAuth } from './useAuth'

export function FeatureAccess({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <p role="status">Checking your account…</p>
  if (auth.status === 'signedOut') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }
  if (auth.status === 'error') {
    return (
      <section role="alert" className="space-y-2">
        <h1 className="text-2xl font-bold">Unable to verify access</h1>
        <p>{auth.message}</p>
        <Link to="/sign-in" className="text-primary underline">Return to sign in</Link>
      </section>
    )
  }
  if (!roles.includes(auth.role)) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">Access restricted</h1>
        <p>Your account does not have permission to open this area.</p>
        <Link to="/" className="text-primary underline">Return home</Link>
      </section>
    )
  }
  return children
}
