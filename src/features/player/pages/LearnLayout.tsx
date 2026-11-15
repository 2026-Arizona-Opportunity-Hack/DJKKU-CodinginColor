import { Link, Navigate, Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageSkeleton } from '@/features/player/components/states'
import { GuestImportNotice } from '@/features/player/components/GuestImportNotice'
import { StudentLayout } from '@/features/player/components/StudentLayout'
import { describeError } from '@/features/player/errors'
import { paths } from '@/features/player/outline'
import { useMe } from '@/features/player/queries'

/** Every /learn route: signed-in students in a class. Anyone else is told what to do, not shown an error. */
export function LearnLayout() {
  const me = useMe()
  if (me.isPending)
    return (
      <StudentLayout>
        <PageSkeleton />
      </StudentLayout>
    )
  if (me.isError) {
    const { message, reference } = describeError(me.error)
    return (
      <StudentLayout>
        <ErrorState message={message} reference={reference} onRetry={() => void me.refetch()} />
      </StudentLayout>
    )
  }
  if (!me.data) return <Navigate to={paths.signIn} replace />
  if (me.data.role !== 'student' && me.data.role !== 'independent_student') {
    return (
      <StudentLayout>
        <EmptyState title="This area is for students">
          <Button asChild variant="outline">
            <Link to="/">Go to your home page</Link>
          </Button>
        </EmptyState>
      </StudentLayout>
    )
  }
  if (me.data.class_id === null) {
    return (
      <StudentLayout me={me.data}>
        <EmptyState title="You're not in a class yet">
          <p>Use your login code or class link.</p>
          <Button asChild variant="outline">
            <Link to={paths.signIn}>Go to sign in</Link>
          </Button>
        </EmptyState>
      </StudentLayout>
    )
  }
  return (
    <StudentLayout me={me.data}>
      {/* Only a self-registered student owns guest progress; the database refuses it for class students. */}
      <GuestImportNotice enabled={me.data.role === 'independent_student'} />
      <Outlet />
    </StudentLayout>
  )
}
