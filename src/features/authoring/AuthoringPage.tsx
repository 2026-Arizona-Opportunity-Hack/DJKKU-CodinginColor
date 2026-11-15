import { Route, Routes } from 'react-router'
import { DemoNote } from '@/components/DemoNote'
import { isDemoMode, useMe } from '@/lib/session'
import { ModuleEditor } from './ModuleEditor'
import { ModuleList } from './ModuleList'

/** `/author`: CIC admins and instructors with authoring rights. The database enforces this too. */
export function AuthoringPage() {
  const me = useMe()
  if (isDemoMode()) return <DemoNote title="Authoring studio">Demo mode: connect Supabase to author modules.</DemoNote>
  if (me.isPending) return <p role="status">Loading…</p>
  const allowed = me.data?.role === 'cic_admin' || me.data?.can_author === true
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Authoring studio</h1>
      {!allowed ? (
        <p role="alert">You don't have authoring access. Ask a CIC admin.</p>
      ) : (
        <Routes>
          <Route index element={<ModuleList />} />
          <Route path="new" element={<ModuleEditor />} />
          <Route path=":moduleId" element={<ModuleEditor />} />
        </Routes>
      )}
    </div>
  )
}
