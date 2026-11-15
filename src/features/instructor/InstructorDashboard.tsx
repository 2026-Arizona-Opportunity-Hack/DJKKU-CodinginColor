import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import {
  isInstructorDatabaseConfigured,
  listInstructorClasses,
  type InstructorClass,
} from './api.supabase'
import {
  isDashboardDatabaseConfigured,
  loadInstructorDashboard,
  type InstructorDashboardData,
} from './dashboardApi.supabase'
import { demoClass, type DashboardStudent } from './dashboardData'
import { round1, summarizeGroup } from '../../../shared/authoring/gain'

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

function formatGain(value: number | null): string {
  if (value === null) return 'Incomplete'

  const rounded = round1(value)

  return `${value > 0 ? '+' : ''}${rounded} pts`
}

/** A student's name as a link to their page (`studentId` is a profile id or a roster seat id). */
function StudentLink({ classId, studentId, name }: { classId: string; studentId: string | null; name: string }) {
  if (!studentId) return <>{name}</>
  return (
    <Link to={`/instructor/${classId}/students/${studentId}`} className="underline underline-offset-4">
      {name}
    </Link>
  )
}

/**
 * For rows without a profile (unclaimed seats): the seat id for a name, using each unclaimed seat once,
 * so two unclaimed students with the same name still get one seat each.
 */
function unclaimedSeatLinks(seats: { id: string; profile_id: string | null; display_name: string }[]) {
  const free = new Map<string, string[]>()
  for (const s of seats) if (!s.profile_id) free.set(s.display_name, [...(free.get(s.display_name) ?? []), s.id])
  return (name: string): string | null => free.get(name)?.shift() ?? null
}

/** `initialClassId` (from the URL) picks the class shown first; otherwise the first class. */
export function InstructorDashboard({ initialClassId }: { initialClassId?: string } = {}) {
  const databaseConfigured =
    isInstructorDatabaseConfigured() && isDashboardDatabaseConfigured()

  const [classes, setClasses] = useState<InstructorClass[]>([])
  const [classId, setClassId] = useState('')
  const [data, setData] = useState<InstructorDashboardData | null>(null)
  const [loading, setLoading] = useState(databaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!databaseConfigured) return

    let cancelled = false

    async function loadClasses() {
      try {
        const result = await listInstructorClasses()

        if (cancelled) return

        setClasses(result)
        setClassId(
          initialClassId && result.some((c) => c.id === initialClassId)
            ? initialClassId
            : (result[0]?.id ?? ''),
        )

        if (result.length === 0) {
          setLoading(false)
        }
      } catch {
        if (cancelled) return

        setError('We could not load your classes.')
        setLoading(false)
      }
    }

    void loadClasses()

    return () => {
      cancelled = true
    }
  }, [databaseConfigured, initialClassId])

  useEffect(() => {
    if (!databaseConfigured || !classId) return

    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const result = await loadInstructorDashboard(classId)

        if (!cancelled) {
          setData(result)
        }
      } catch {
        if (!cancelled) {
          setError('We could not load dashboard data for this class.')
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [classId, databaseConfigured])

  if (!databaseConfigured) {
    return <DemoDashboard />
  }

  const selectedClass = classes.find((item) => item.id === classId)

  return (
    <section aria-labelledby="class-dashboard-heading" className="space-y-8">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Live class data
          </p>
          <h2
            id="class-dashboard-heading"
            className="text-2xl font-semibold"
          >
            Instructor progress
          </h2>
        </div>

        {classes.length > 0 && (
          <div>
            <label htmlFor="dashboard-class" className="block text-sm font-medium">
              Class
            </label>

            <select
              id="dashboard-class"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value)
                setData(null)
              }}
              className="mt-1 block w-full max-w-md rounded-md border px-3 py-2"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                  {classItem.term ? ` - ${classItem.term}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="rounded-lg border p-4">Loading dashboard...</p>
      ) : error ? (
        <p role="alert" className="rounded-lg border p-4 text-destructive">
          {error}
        </p>
      ) : classes.length === 0 ? (
        <p className="rounded-lg border p-4">
          You do not have any classes yet.
        </p>
      ) : data ? (
        <LiveDashboard
          classId={classId}
          className={selectedClass?.name ?? 'Class'}
          data={data}
        />
      ) : null}
    </section>
  )
}

function LiveDashboard({
  classId,
  className,
  data,
}: {
  classId: string
  className: string
  data: InstructorDashboardData
}) {
  const students = data.progress
  // An unclaimed seat has no profile id, so it links by seat id (the student page accepts either),
  // which is how an instructor reaches Reset login code for a student who has not joined yet.
  // One resolver per list, so each list can use every seat once.
  const rosterLink = unclaimedSeatLinks(data.seats ?? [])
  const notStartedLink = unclaimedSeatLinks(data.seats ?? [])

  const averageProgress =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce(
            (total, student) => total + student.completion_pct,
            0,
          ) / students.length,
        )

  const overallGainRows = data.learningGain.filter(
  (row) => row.scope === 'class' && row.concept_id === null,
)

const classGain =
  overallGainRows.length === 1 ? overallGainRows[0] : null

  const progressByStudent = new Map(
    data.progress
      .filter((row) => row.student_id !== null)
      .map((row) => [row.student_id, row]),
  )

  const nameByStudent = new Map(
    data.progress
      .filter((row) => row.student_id !== null)
      .map((row) => [row.student_id, row.display_name]),
  )

  const masteryByConcept = new Map<
    string,
    { total: number; count: number }
  >()

  for (const row of data.mastery) {
    const current = masteryByConcept.get(row.concept_id) ?? {
      total: 0,
      count: 0,
    }

    current.total += row.mastery_pct
    current.count += 1
    masteryByConcept.set(row.concept_id, current)
  }

  const concepts = [...masteryByConcept.entries()]
    .map(([concept, summary]) => ({
      concept,
      masteryPercent: Math.round(summary.total / summary.count),
    }))
    .sort((a, b) => b.masteryPercent - a.masteryPercent)

  const reteach = [...data.reteach].sort(
    (a, b) => b.wrong_rate_pct - a.wrong_rate_pct,
  )[0]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">{className}</h3>
        <p className="text-sm text-muted-foreground">
          Data from the current class roster and student activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Students" value={String(students.length)} />
        <MetricCard
          label="Average progress"
          value={`${averageProgress}%`}
        />
        <MetricCard
          label="Learning gain"
          value={formatGain(classGain?.gain_points ?? null)}
          detail={
  classGain
    ? `${classGain.complete_count} measured · ${classGain.incomplete_count} incomplete`
    : overallGainRows.length > 1
      ? 'Select a module to view learning gain'
      : 'No complete pre/post results yet'
}
        />
      </div>

      <section aria-labelledby="roster-progress-heading" className="space-y-3">
        <div>
          <h3 id="roster-progress-heading" className="text-xl font-semibold">
            Students
          </h3>
          <p className="text-sm text-muted-foreground">
            Open a student to see their full progress, learning gain and next steps.
          </p>
        </div>

        {students.length === 0 ? (
          <p className="rounded-lg border p-4">No students on the roster yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Every student in {className}</caption>
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="border-b px-3 py-2 text-left font-semibold">Student</th>
                  <th scope="col" className="border-b px-3 py-2 text-left font-semibold">Done</th>
                  <th scope="col" className="border-b px-3 py-2 text-left font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {[...students]
                  .sort((a, b) => a.display_name.localeCompare(b.display_name))
                  .map((student, index) => (
                    <tr key={`${student.student_id ?? student.display_name}-${index}`}>
                      <td className="border-b px-3 py-2">
                        <StudentLink classId={classId} studentId={student.student_id ?? rosterLink(student.display_name)} name={student.display_name} />
                        {!student.joined && <span className="block text-xs text-muted-foreground">Seat not claimed</span>}
                      </td>
                      <td className="border-b px-3 py-2">{Math.round(student.completion_pct)}%</td>
                      <td className="border-b px-3 py-2">
                        {student.last_active_at ? new Date(student.last_active_at).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div>
          <h3 id="attention-heading" className="text-xl font-semibold">
            Needs attention
          </h3>
          <p className="text-sm text-muted-foreground">
            Students currently flagged by class activity.
          </p>
        </div>

        {data.stuck.length === 0 ? (
          <p className="rounded-lg border p-4">
            No students are currently stuck.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.stuck.map((student, index) => {
              const progress = progressByStudent.get(student.student_id)
              const name =
                nameByStudent.get(student.student_id) ?? 'Student'

              return (
                <li
                  key={`${student.student_id}-${student.activity_id ?? 'inactive'}-${index}`}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      <StudentLink classId={classId} studentId={student.student_id} name={name} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {student.reasons.includes('wrong_attempts')
                        ? `${student.wrong_attempts} wrong attempts`
                        : student.reasons.includes('long_time')
                          ? `${student.minutes_on_activity} minutes on activity`
                          : `${student.days_inactive} school days inactive`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hints used: {student.hints_used}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {progress?.completion_pct ?? 0}% complete
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="not-started-heading" className="space-y-3">
        <div>
          <h3 id="not-started-heading" className="text-xl font-semibold">
            Not started
          </h3>
          <p className="text-sm text-muted-foreground">
            Enrolled students with no recorded progress.
          </p>
        </div>

        {data.notStarted.length === 0 ? (
          <p className="rounded-lg border p-4">
            Everyone has started this class.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.notStarted.map((student, index) => (
              <li
                key={`${student.student_id ?? student.display_name}-${index}`}
                className="rounded-lg border p-4"
              >
                <p className="font-medium">
                  <StudentLink classId={classId} studentId={student.student_id ?? notStartedLink(student.display_name)} name={student.display_name} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {student.joined ? '0% complete' : 'Roster seat not claimed'}
                </p>
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
          <p className="text-sm text-muted-foreground">
            Average class mastery from scored attempts.
          </p>
        </div>

        {concepts.length === 0 ? (
          <p className="rounded-lg border p-4">
            No concept mastery data yet.
          </p>
        ) : (
          <div className="space-y-4">
            {concepts.map((concept) => (
              <div key={concept.concept}>
                <div className="mb-1 flex justify-between gap-4 text-sm">
                  <span className="font-medium">{concept.concept}</span>
                  <span>{concept.masteryPercent}%</span>
                </div>

                <div
                  className="h-3 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`${concept.concept} mastery`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={concept.masteryPercent}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${concept.masteryPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {reteach && (
          <p className="rounded-lg border p-4">
            <span className="font-semibold">Reteach tomorrow:</span>{' '}
            {reteach.concept_id} has a {Math.round(reteach.wrong_rate_pct)}%
            wrong-answer rate across {reteach.students} students.
          </p>
        )}
      </section>
    </div>
  )
}

function DemoDashboard() {
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
          <p className="text-sm font-medium text-muted-foreground">
            {demoClass.school}
          </p>
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
          value={formatGain(gain.meanGain)}
          detail={`${gain.completeCount} of ${students.length} students measured`}
        />
      </div>

      <section aria-labelledby="demo-attention-heading" className="space-y-3">
        <div>
          <h3 id="demo-attention-heading" className="text-xl font-semibold">
            Needs attention
          </h3>
          <p className="text-sm text-muted-foreground">
            Students who may need instructor support now.
          </p>
        </div>

        <ul className="divide-y rounded-lg border">
          {stuckStudents.map((student) => (
            <li
              key={student.studentId}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">
                  <StudentLink classId="demo" studentId={student.studentId} name={student.displayName} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {student.currentActivity}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="inline-block rounded-full bg-tint-yellow px-3 py-1 text-sm font-medium text-tint-yellow-fg">
                  {stuckReason(student)}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.progressPercent}% complete
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="demo-not-started-heading"
        className="space-y-3"
      >
        <div>
          <h3
            id="demo-not-started-heading"
            className="text-xl font-semibold"
          >
            Not started
          </h3>
          <p className="text-sm text-muted-foreground">
            Enrolled students with no progress yet.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {notStartedStudents.map((student) => (
            <li
              key={student.studentId}
              className="rounded-lg border p-4"
            >
              <p className="font-medium">
                <StudentLink classId="demo" studentId={student.studentId} name={student.displayName} />
              </p>
              <p className="text-sm text-muted-foreground">0% complete</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="demo-mastery-heading"
        className="space-y-4"
      >
        <div>
          <h3 id="demo-mastery-heading" className="text-xl font-semibold">
            Concept mastery
          </h3>
          <p className="text-sm text-muted-foreground">
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
                className="h-3 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${concept.concept} mastery`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={concept.masteryPercent}
              >
                <div
                  className="h-full rounded-full bg-primary"
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail && (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  )
}