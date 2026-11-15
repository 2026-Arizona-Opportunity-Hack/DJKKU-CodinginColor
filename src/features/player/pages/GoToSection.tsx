import { Navigate, useParams } from 'react-router'

import { paths } from '@/features/player/outline'
import { useMe } from '@/features/player/queries'

/** Guide links (/learn/go/<section>) open that page in the student's own class. */
export function GoToSection() {
  const { section = '' } = useParams()
  const me = useMe()
  if (me.isPending) return <p role="status">Opening your class…</p>
  const classId = me.data?.class_id
  if (!classId) return <Navigate to={paths.home} replace />
  const to = section === 'progress' ? paths.progress(classId) : section === 'notebook' ? paths.notebook(classId) : section === 'path' ? paths.path(classId) : paths.home
  return <Navigate to={to} replace />
}
