import { InstructorDashboard } from './InstructorDashboard'
import { RosterImport } from './RosterImport'

export function InstructorPage() {
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-bold">Instructor dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage your class and see where students need support.
        </p>
      </header>

      <InstructorDashboard />

      <div className="border-t pt-8">
        <RosterImport />
      </div>
    </div>
  )
}