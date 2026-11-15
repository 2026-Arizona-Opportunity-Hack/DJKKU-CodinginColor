import { Navigate, Route, Routes } from 'react-router'
import { isDemoMode } from '@/lib/session'
import { ClassHome } from './ClassHome'
import { ClassPicker } from './ClassPicker'
import { CreateClassForm } from './CreateClassForm'
import { ImpactReport } from './ImpactReport'
import { LiveView } from './LiveView'
import { InstructorDashboard } from './InstructorDashboard'
import { useClasses } from './hooks'

/** `/instructor` (pick or create a class) and `/instructor/:classId` (run it). */
export function InstructorPage() {
  if (isDemoMode()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Instructor dashboard</h1>
        <p role="status" className="text-sm">Demo mode: connect Supabase to run a real class. This is sample data.</p>
        <InstructorDashboard />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 print:hidden">
        <h1 className="text-3xl font-bold">Instructor home</h1>
        <ClassPicker />
      </header>
      <Routes>
        <Route index element={<FirstClass />} />
        <Route path="new" element={<CreateClassForm />} />
        <Route path=":classId" element={<ClassHome />} />
        <Route path=":classId/live" element={<LiveView />} />
        <Route path=":classId/report" element={<ImpactReport />} />
      </Routes>
    </div>
  )
}

/** /instructor on its own goes to your first class, or to the create form when there is none. */
function FirstClass() {
  const classes = useClasses()
  if (classes.data?.[0]) return <Navigate to={`/instructor/${classes.data[0].id}`} replace />
  if (classes.data) return <CreateClassForm />
  return null
}
