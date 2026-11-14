import { summarizeGroup, round1 } from '../../../shared/authoring/gain'
import { demoClass, type DashboardStudent } from './dashboardData'

function stuckReason(student: DashboardStudent): string | null {
  if (student.wrongAttempts >= 3) {
    return `${student.wrongAttempts} wrong attempts`
  }

  if (student.minutesOnActivity > 10) {
    return `${student.minutesOnActivity} minutes on activity`
  }

  if (student.daysInactive >= 3) {
    return `No activity for ${student.daysInactive} school days`
  }

  return null
}

export function InstructorDashboard() {
  const students = demoClass.students

  const averageProgress =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce(
            (total, student) => total + student.progressPercent,
            0,
          ) / students.length,
        )

  const gain = summarizeGroup(
    students.map((student) => ({
      studentId: student.studentId,
      pre: student.preScore,
      post: student.postScore,
    })),
  )

  const stuckStudents = students.filter(
    (student) => stuckReason(student) !== null,
  )

  const notStartedStudents = students.filter(
    (student) => student.progressPercent === 0,
  )

  const weakestConcept = [...demoClass.concepts].sort(
    (a, b) => a.masteryPercent - b.masteryPercent,
  )[0]

  return (
    <section aria-labelledby="class-dashboard-heading" className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-600">
            {demoClass.school}
          </p>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            Demo data
          </span>
        </div>

        <h2
          id="class-dashboard-heading"
          className="text-2xl font-semibold"
        >
          {demoClass.name}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Students" value={String(students.length)} />
        <MetricCard
          label="Average progress"
          value={`${averageProgress}%`}
        />
        <MetricCard
          label="Learning gain"
          value={
            gain.meanGain === null
              ? 'Incomplete'
              : `${gain.meanGain > 0 ? '+' : ''}${round1(gain.meanGain)} pts`
          }
          detail={`${gain.completeCount} of ${students.length} students measured`}
        />
      </div>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div>
          <h3 id="attention-heading" className="text-xl font-semibold">
            Needs attention
          </h3>
          <p className="text-sm text-gray-600">
            Students who may need instructor support now.
          </p>
        </div>

        {stuckStudents.length === 0 ? (
          <p className="rounded-lg border p-4">
            No students are currently stuck.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {stuckStudents.map((student) => (
              <li
                key={student.studentId}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{student.displayName}</p>
                  <p className="text-sm text-gray-600">
                    {student.currentActivity}
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    {stuckReason(student)}
                  </span>
                  <p className="mt-1 text-sm text-gray-600">
                    {student.progressPercent}% complete
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="not-started-heading"
        className="space-y-3"
      >
        <div>
          <h3
            id="not-started-heading"
            className="text-xl font-semibold"
          >
            Not started
          </h3>
          <p className="text-sm text-gray-600">
            Enrolled students with no progress yet.
          </p>
        </div>

        {notStartedStudents.length === 0 ? (
          <p className="rounded-lg border p-4">
            Everyone has started this module.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {notStartedStudents.map((student) => (
              <li
                key={student.studentId}
                className="rounded-lg border p-4"
              >
                <p className="font-medium">{student.displayName}</p>
                <p className="text-sm text-gray-600">0% complete</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mastery-heading" className="space-y-4">
        <div>
          <h3 id="mastery-heading" className="text-xl font-semibold">
            Concept mastery
          </h3>
          <p className="text-sm text-gray-600">
            Class performance by curriculum concept.
          </p>
        </div>

        <div className="space-y-4">
          {demoClass.concepts.map((concept) => (
            <div key={concept.concept}>
              <div className="mb-1 flex justify-between gap-4 text-sm">
                <span className="font-medium">{concept.concept}</span>
                <span>{concept.masteryPercent}%</span>
              </div>

              <div
                className="h-3 overflow-hidden rounded-full bg-gray-200"
                role="progressbar"
                aria-label={`${concept.concept} mastery`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={concept.masteryPercent}
              >
                <div
                  className="h-full rounded-full bg-gray-800"
                  style={{ width: `${concept.masteryPercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {weakestConcept && (
          <p className="rounded-lg border p-4">
            <span className="font-semibold">Reteach tomorrow:</span>{' '}
            {weakestConcept.concept} is currently the class&apos;s
            lowest-mastery concept at {weakestConcept.masteryPercent}%.
          </p>
        )}
      </section>
    </section>
  )
}

interface MetricCardProps {
  label: string
  value: string
  detail?: string
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail && (
        <p className="mt-1 text-xs text-gray-600">{detail}</p>
      )}
    </div>
  )
}