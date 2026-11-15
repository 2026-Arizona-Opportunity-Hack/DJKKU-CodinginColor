import { Route, Routes } from 'react-router'
import { DemoNote } from '@/components/DemoNote'
import { isDemoMode, useMe } from '@/lib/session'
import { ModuleList } from './ModuleList'
import { ModuleView } from './ModuleView'

/** `/review`: a read-only view of published curriculum for external reviewers (and CIC admins). */
export function ReviewerPage() {
  const me = useMe()
  if (isDemoMode()) return <DemoNote title="Curriculum review">Demo mode: connect Supabase to review published modules.</DemoNote>
  if (me.isPending) return <p role="status">Loading…</p>
  if (me.data?.role !== 'reviewer' && me.data?.role !== 'cic_admin') return <p role="alert">This page is for curriculum reviewers.</p>
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Curriculum review</h1>
      <p role="note" className="rounded-md border border-tint-yellow-edge bg-tint-yellow p-3 font-medium text-tint-yellow-fg">
        Read-only. Answer keys and student data are hidden by design.
      </p>
      <Routes>
        <Route index element={<ModuleList />} />
        <Route path=":moduleId" element={<ModuleView />} />
      </Routes>
    </div>
  )
}
