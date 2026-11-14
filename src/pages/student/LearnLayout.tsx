import { Navigate, Outlet } from 'react-router'

import { ErrorState, PageSkeleton } from '@/components/states'
import { StudentLayout } from '@/features/student/components/StudentLayout'
import { describeError } from '@/features/student/errors'
import { useMe } from '@/features/student/queries'

/** Every /learn route: signed-in students only; anyone else goes to /start. */
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
  if (!me.data) return <Navigate to="/start" replace />
  return (
    <StudentLayout me={me.data}>
      <Outlet />
    </StudentLayout>
  )
}
