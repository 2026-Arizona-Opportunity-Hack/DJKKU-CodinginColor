import { Navigate, NavLink, Route, Routes } from 'react-router'
import { isDemoMode, useMe } from '@/lib/session'
import { OverviewTab } from './OverviewTab'
import { PublishQueue } from './PublishQueue'
import { StaffTab } from './StaffTab'

const TABS = [
  { path: 'publish', label: 'Publish queue', element: <PublishQueue /> },
  { path: 'overview', label: 'Overview', element: <OverviewTab /> },
  { path: 'staff', label: 'Staff', element: <StaffTab /> },
]

/** `/admin/<tab>`: the CIC admin console. Only CIC admins; the database enforces it too. */
export function AdminPage() {
  const me = useMe()
  if (isDemoMode()) return <p role="status">Demo mode: connect Supabase to use the admin console.</p>
  if (me.isPending) return <p role="status">Loading…</p>
  if (me.data?.role !== 'cic_admin') return <p role="alert">This page is for CIC admins.</p>
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Admin console</h1>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <NavLink key={t.path} to={`/admin/${t.path}`} className={({ isActive }) => `inline-flex min-h-11 items-center rounded-md px-3 ${isActive ? 'bg-primary text-primary-foreground' : 'underline'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="/admin/publish" replace />} />
        {TABS.map((t) => <Route key={t.path} path={t.path} element={t.element} />)}
        <Route path="*" element={<Navigate to="/admin/publish" replace />} />
      </Routes>
    </div>
  )
}
