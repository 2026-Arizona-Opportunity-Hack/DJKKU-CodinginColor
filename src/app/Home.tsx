import { Link, Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { homePathFor, isDemoMode, useMe } from '@/lib/session'

// Signed in: straight to your own home. Signed out (and in demo mode): a short way in.
export function Home() {
  const demo = isDemoMode()
  const me = useMe()
  if (!demo && me.data) return <Navigate to={homePathFor(me.data)} replace />
  if (!demo && me.isPending) return <p role="status">Loading…</p>

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Coding in Color</h1>
      <p className="text-lg">
        Self-paced coding lessons for Coding in Color's classes, with progress your instructor can see.
      </p>
      {demo && <p className="text-sm font-medium">Demo mode: sample data only, no database is connected.</p>}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg"><Link to="/sign-in">I have a login code</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/learn/explore">Browse lessons</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/sign-in#staff">Staff sign in</Link></Button>
      </div>
    </section>
  )
}
