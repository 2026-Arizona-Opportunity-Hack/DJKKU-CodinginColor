import { useEffect, useState, type FormEvent } from 'react'

import { isDemoMode } from '@/lib/session'

import {
  addClassInstructor,
  inviteStaff,
  listClasses,
  listProfiles,
  listSchools,
  type AdminClass,
  type AdminProfile,
  type AdminSchool,
} from './api.supabase'

type StaffRole = 'mentor' | 'instructor' | 'cic_admin' | 'reviewer'

/** Jad's organization overview, invite form and class staffing. One tab of the admin console. */
export function OverviewTab() {
  const demoMode = isDemoMode()

  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [classes, setClasses] = useState<AdminClass[]>([])
  const [schools, setSchools] = useState<AdminSchool[]>([])

  const [loading, setLoading] = useState(!demoMode)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (demoMode) return

    let cancelled = false

    async function loadAdminData() {
      try {
        const [profileRows, classRows, schoolRows] = await Promise.all([
          listProfiles(),
          listClasses(),
          listSchools(),
        ])

        if (cancelled) return

        setProfiles(profileRows)
        setClasses(classRows)
        setSchools(schoolRows)
      } catch (cause) {
        if (cancelled) return

        setLoadError(
          cause instanceof Error
            ? cause.message
            : 'We could not load the admin console.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAdminData()

    return () => {
      cancelled = true
    }
  }, [demoMode])

  const instructors = profiles.filter(
    (profile) =>
      profile.role === 'instructor' || profile.role === 'cic_admin',
  )

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-bold">CIC administration</h2>
        <p className="mt-2 text-gray-600">
          Manage partner schools, staff, and class staffing across Coding in
          Color.
        </p>
      </header>

      {demoMode ? (
        <div className="rounded-lg border p-5">
          <p className="font-semibold">Demo mode</p>
          <p className="mt-1 text-sm text-gray-600">
            Connect Supabase and sign in as a CIC admin to manage the
            organization.
          </p>
        </div>
      ) : loading ? (
        <p role="status" className="rounded-lg border p-5">
          Loading administration data...
        </p>
      ) : loadError ? (
        <p role="alert" className="rounded-lg border p-5 text-red-700">
          {loadError}
        </p>
      ) : (
        <>
          <OrganizationOverview
            schools={schools}
            classes={classes}
            profiles={profiles}
          />

          <InviteStaffForm />

          <ClassStaffing
            classes={classes}
            instructors={instructors}
          />
        </>
      )}
    </div>
  )
}

function OrganizationOverview({
  schools,
  classes,
  profiles,
}: {
  schools: AdminSchool[]
  classes: AdminClass[]
  profiles: AdminProfile[]
}) {
  const staffCount = profiles.filter(
    (profile) =>
      profile.role !== 'student' &&
      profile.role !== 'independent_student',
  ).length

  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <div>
        <h2 id="overview-heading" className="text-2xl font-semibold">
          Organization overview
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          CIC-wide setup visible only to administrators.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Partner schools" value={schools.length} />
        <Metric label="Classes" value={classes.length} />
        <Metric label="Staff accounts" value={staffCount} />
      </div>

      {classes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-3">
                  Class
                </th>
                <th scope="col" className="p-3">
                  School
                </th>
                <th scope="col" className="p-3">
                  Term
                </th>
              </tr>
            </thead>

            <tbody>
              {classes.map((classItem) => {
                const school = schools.find(
                  (item) => item.id === classItem.school_id,
                )

                return (
                  <tr key={classItem.id} className="border-b">
                    <td className="p-3 font-medium">{classItem.name}</td>
                    <td className="p-3">{school?.name ?? '—'}</td>
                    <td className="p-3">{classItem.term ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function InviteStaffForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('instructor')
  const [canAuthor, setCanAuthor] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Enter an email address.')
      return
    }

    setSubmitting(true)

    try {
      await inviteStaff(email, role, canAuthor)

      setSuccess(`Invitation saved for ${email.trim().toLowerCase()}.`)
      setEmail('')
      setCanAuthor(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not invite staff.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="invite-heading" className="max-w-2xl space-y-4">
      <div>
        <h2 id="invite-heading" className="text-2xl font-semibold">
          Invite staff
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Their role is applied when they sign in with the invited Google
          account.
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5 rounded-lg border p-5"
      >
        <div>
          <label htmlFor="staff-email" className="block font-medium">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 block w-full rounded-md border px-3 py-2"
            placeholder="teacher@example.org"
          />
        </div>

        <div>
          <label htmlFor="staff-role" className="block font-medium">
            Role
          </label>
          <select
            id="staff-role"
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className="mt-2 block w-full rounded-md border px-3 py-2"
          >
            <option value="instructor">Instructor</option>
            <option value="reviewer">External reviewer</option>
            <option value="mentor">Mentor</option>
            <option value="cic_admin">CIC admin</option>
          </select>
        </div>

        {role === 'instructor' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={canAuthor}
              onChange={(event) => setCanAuthor(event.target.checked)}
            />
            <span>Allow curriculum authoring</span>
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="rounded-lg border p-3 font-medium">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving invitation...' : 'Invite staff'}
        </button>
      </form>
    </section>
  )
}

function ClassStaffing({
  classes,
  instructors,
}: {
  classes: AdminClass[]
  instructors: AdminProfile[]
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [profileId, setProfileId] = useState(instructors[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!classId || !profileId) {
      setError('Choose a class and instructor.')
      return
    }

    setSubmitting(true)

    try {
      await addClassInstructor(classId, profileId)

      const classItem = classes.find((item) => item.id === classId)
      const instructor = instructors.find((item) => item.id === profileId)

      setSuccess(
        `${instructor?.display_name || 'Instructor'} added to ${
          classItem?.name ?? 'class'
        }.`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not update class staffing.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="staffing-heading" className="max-w-2xl space-y-4">
      <div>
        <h2 id="staffing-heading" className="text-2xl font-semibold">
          Class staffing
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Assign an existing CIC instructor to a class.
        </p>
      </div>

      {classes.length === 0 || instructors.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-gray-600">
          You need at least one class and one instructor account before
          assigning staff.
        </p>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5 rounded-lg border p-5"
        >
          <div>
            <label htmlFor="staffing-class" className="block font-medium">
              Class
            </label>
            <select
              id="staffing-class"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value)
                setSuccess('')
              }}
              className="mt-2 block w-full rounded-md border px-3 py-2"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                  {classItem.term ? ` - ${classItem.term}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="staffing-instructor" className="block font-medium">
              Instructor
            </label>
            <select
              id="staffing-instructor"
              value={profileId}
              onChange={(event) => {
                setProfileId(event.target.value)
                setSuccess('')
              }}
              className="mt-2 block w-full rounded-md border px-3 py-2"
            >
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.display_name || 'Unnamed instructor'}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="rounded-lg border p-3 font-medium">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Updating...' : 'Assign instructor'}
          </button>
        </form>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}