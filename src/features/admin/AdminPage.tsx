import { useState, type FormEvent } from 'react'

import {
  createClass,
  isAdminDatabaseConfigured,
} from './api.supabase'

export function AdminPage() {
  const databaseConfigured = isAdminDatabaseConfigured()

  const [schoolName, setSchoolName] = useState('')
  const [className, setClassName] = useState('')
  const [term, setTerm] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdClassId, setCreatedClassId] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanSchool = schoolName.trim()
    const cleanClass = className.trim()

    setError('')
    setCreatedClassId('')

    if (!cleanSchool) {
      setError('Enter a school name.')
      return
    }

    if (!cleanClass) {
      setError('Enter a class name.')
      return
    }

    if (!databaseConfigured) {
      setError('Connect Supabase before creating a real class.')
      return
    }

    setSubmitting(true)

    try {
      const classId = await createClass({
        schoolName: cleanSchool,
        name: cleanClass,
        term,
      })

      setCreatedClassId(classId)
      setClassName('')
      setTerm('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not create this class.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Class setup and admin</h1>
        <p className="mt-2 text-gray-600">
          Create classes and prepare them for instructors and students.
        </p>
      </header>

      <section
        aria-labelledby="create-class-heading"
        className="max-w-2xl space-y-6"
      >
        <div>
          <h2
            id="create-class-heading"
            className="text-2xl font-semibold"
          >
            Create a class
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Add the school, class name, and optional term. Student roster
            information is managed separately.
          </p>
        </div>

        {!databaseConfigured && (
          <div className="rounded-lg border p-4">
            <p className="font-medium">Demo mode</p>
            <p className="mt-1 text-sm text-gray-600">
              The form is available for preview, but creating a real class
              requires a Supabase connection.
            </p>
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5 rounded-lg border p-5"
        >
          <div>
            <label htmlFor="school-name" className="block font-medium">
              School
            </label>
            <input
              id="school-name"
              type="text"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              maxLength={120}
              autoComplete="organization"
              className="mt-2 block w-full rounded-md border px-3 py-2"
              placeholder="Maryvale"
            />
            <p className="mt-1 text-sm text-gray-600">
              Instructors can use an existing school. Only CIC admins can add
              a new school.
            </p>
          </div>

          <div>
            <label htmlFor="class-name" className="block font-medium">
              Class name
            </label>
            <input
              id="class-name"
              type="text"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              maxLength={120}
              className="mt-2 block w-full rounded-md border px-3 py-2"
              placeholder="Intro to Python"
            />
          </div>

          <div>
            <label htmlFor="class-term" className="block font-medium">
              Term <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <input
              id="class-term"
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              maxLength={40}
              className="mt-2 block w-full rounded-md border px-3 py-2"
              placeholder="Fall 2026"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {createdClassId && (
            <div
              role="status"
              className="rounded-lg border p-4"
            >
              <p className="font-semibold">Class created.</p>
              <p className="mt-1 text-sm text-gray-600">
                You can now import a roster and assign curriculum to this
                class.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !databaseConfigured}
            className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating class...' : 'Create class'}
          </button>
        </form>
      </section>
    </div>
  )
}