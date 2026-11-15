import { Navigate, Route, Routes } from 'react-router'
import { isDemoMode } from '@/lib/session'
import { ModuleList } from './ModuleList'
import { ModuleView } from './ModuleView'

/**
 * Lane E (M9): read-only curriculum for external reviewers.
 * `/review` lists published modules; `/review/:moduleId` shows one. Who may open this page is
 * decided by the layout (reviewers and CIC admins) and, for the data, by row-level security.
 */
export function ReviewerPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Curriculum review</h1>
        <p role="note" className="text-sm text-muted-foreground">
          You are reviewing published curriculum, read only. Answer keys and student information are never shown here.
        </p>
      </header>
      {isDemoMode() ? (
        <p role="status">Demo mode: connect Supabase to review the published curriculum.</p>
      ) : (
        <Routes>
          <Route index element={<ModuleList />} />
          <Route path=":moduleId" element={<ModuleView />} />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Routes>
      )}
    </div>
  )
}
