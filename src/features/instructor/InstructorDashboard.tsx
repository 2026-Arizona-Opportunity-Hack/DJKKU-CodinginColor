import { useEffect, useState } from 'react'

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

export function InstructorDashboard() {
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
        setClassId(result[0]?.id ?? '')

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
  }, [databaseConfigured])

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
          <p className="text-sm font-medium text-gray-600">
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
        <p role="alert" className="rounded-lg border p-4 text-red-700">
          {error}
        </p>
      ) : classes.length === 0 ? (
        <p className="rounded-lg border p-4">
          You do not have any classes yet.
        </p>
      ) : data ? (
        <LiveDashboard
          className={selectedClass?.name ?? 'Class'}
          data={data}
        />
      ) : null}
    </section>
  )
}

function LiveDashboard({
  className,
  data,
}: {
  className: string
  data: InstructorDashboardData
}) {
  const students = data.progress

  const averageProgress =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce(
            (total, student) => total + student.completion_pct,
            0,
          ) / students.length,
        )

  const classGain =
    data.learningGain.find(
      (row) => row.scope === 'class' && row.concept_id === null,
    ) ?? null

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
        <p className="text-sm text-gray-600">
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
              : 'No complete pre/post results yet'
          }
        />
      </div>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div>
          <h3 id="attention-heading" className="text-xl font-semibold">
            Needs attention
          </h3>
          <p className="text-sm text-gray-600">
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
                    <p className="font-semibold">{name}</p>
                    <p className="text-sm text-gray-600">
                      {student.reasons.includes('wrong_attempts')
                        ? `${student.wrong_attempts} wrong attempts`
                        : student.reasons.includes('long_time')
                          ? `${student.minutes_on_activity} minutes on activity`
                          : `${student.days_inactive} school days inactive`}
                    </p>
                  </div>

                  <p className="text-sm text-gray-600">
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
          <p className="text-sm text-gray-600">
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
                <p className="font-medium">{student.display_name}</p>
                <p className="text-sm text-gray-600">
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
          <p className="text-sm text-gray-600">
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
          value={formatGain(gain.meanGain)}
          detail={`${gain.completeCount} of ${students.length} students measured`}
        />
      </div>

      <section aria-labelledby="demo-attention-heading" className="space-y-3">
        <div>
          <h3 id="demo-attention-heading" className="text-xl font-semibold">
            Needs attention
          </h3>
          <p className="text-sm text-gray-600">
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
          <p className="text-sm text-gray-600">
            Enrolled students with no progress yet.
          </p>
        </div>

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
      </section>

      <section
        aria-labelledby="demo-mastery-heading"
        className="space-y-4"
      >
        <div>
          <h3 id="demo-mastery-heading" className="text-xl font-semibold">
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