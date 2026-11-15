import { Navigate, Route, Routes } from 'react-router'
import { isDemoMode } from '@/lib/session'
import { ClassHome } from './ClassHome'
import { ClassPicker } from './ClassPicker'
import { CreateClassForm } from './CreateClassForm'
import { ImpactReport } from './ImpactReport'
import { LiveView } from './LiveView'
import { InstructorDashboard } from './InstructorDashboard'
import { useClasses } from './hooks'
import { StudentPage } from './student/StudentPage'

/**
 * `/instructor` (pick or create a class), `/instructor/:classId` (run it) and
 * `/instructor/:classId/students/:studentId` (one student, in depth).
 */
export function InstructorPage() {
  if (isDemoMode()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Instructor dashboard</h1>
        <Routes>
          <Route path=":classId/students/:studentId" element={<StudentPage />} />
          <Route
            path="*"
            element={
              <>
                <p role="status" className="text-sm">Demo mode: connect Supabase to run a real class. This is sample data.</p>
                <InstructorDashboard />
              </>
            }
          />
        </Routes>
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
        <Route path=":classId/students/:studentId" element={<StudentPage />} />
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
