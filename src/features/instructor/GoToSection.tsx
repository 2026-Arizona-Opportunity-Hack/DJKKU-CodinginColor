import { Navigate, useParams } from 'react-router'
import { useClasses } from './hooks'

// Guide links (/instructor/go/<section>) open that part of your first class, or the create form if you
// have no class yet. Pages are routes; the rest are sections of the class page.
const PAGES = new Set(['live', 'reteach', 'report'])
const SECTIONS = new Set(['join-code', 'roster', 'assign', 'starting-point', 'dashboard'])
export function GoToSection() {
  const { section = '' } = useParams()
  const classes = useClasses()
  if (classes.isPending) return <p role="status">Opening your class…</p>
  const first = classes.data?.[0]
  if (!first) return <Navigate to="/instructor/new" replace />
  if (PAGES.has(section)) return <Navigate to={`/instructor/${first.id}/${section}`} replace />
  return <Navigate to={`/instructor/${first.id}${SECTIONS.has(section) ? `#${section}` : ''}`} replace />
}
