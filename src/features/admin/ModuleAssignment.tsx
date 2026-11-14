import { useEffect, useState, type FormEvent } from 'react'

import {
  assignModule,
  isAdminDatabaseConfigured,
  listAdminClasses,
  listPublishedModules,
  type AdminClass,
  type PublishedModule,
} from './api.supabase'

export function ModuleAssignment() {
  const databaseConfigured = isAdminDatabaseConfigured()

  const [classes, setClasses] = useState<AdminClass[]>([])
  const [modules, setModules] = useState<PublishedModule[]>([])

  const [classId, setClassId] = useState('')
  const [moduleId, setModuleId] = useState('')

  const [loading, setLoading] = useState(databaseConfigured)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!databaseConfigured) return

    let cancelled = false

    async function loadOptions() {
      try {
        const [classRows, moduleRows] = await Promise.all([
          listAdminClasses(),
          listPublishedModules(),
        ])

        if (cancelled) return

        setClasses(classRows)
        setModules(moduleRows)
        setClassId(classRows[0]?.id ?? '')
        setModuleId(moduleRows[0]?.id ?? '')
      } catch {
        if (!cancelled) {
          setError('We could not load classes and published modules.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [databaseConfigured])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!classId) {
      setError('Choose a class.')
      return
    }

    if (!moduleId) {
      setError('Choose a published module.')
      return
    }

    setSubmitting(true)

    try {
      await assignModule(classId, moduleId)

      const selectedClass = classes.find((item) => item.id === classId)
      const selectedModule = modules.find((item) => item.id === moduleId)

      setSuccess(
        `${selectedModule?.title ?? 'Module'} assigned to ${
          selectedClass?.name ?? 'class'
        }.`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not assign this module.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="assign-module-heading"
      className="max-w-2xl space-y-6"
    >
      <div>
        <h2 id="assign-module-heading" className="text-2xl font-semibold">
          Assign curriculum
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Choose a published module and make it available to a class.
        </p>
      </div>

      {!databaseConfigured ? (
        <div className="rounded-lg border p-4">
          <p className="font-medium">Demo mode</p>
          <p className="mt-1 text-sm text-gray-600">
            Connect Supabase to load classes and published curriculum.
          </p>
        </div>
      ) : loading ? (
        <p className="rounded-lg border p-4">
          Loading classes and curriculum...
        </p>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-5 rounded-lg border p-5"
        >
          <div>
            <label htmlFor="assignment-class" className="block font-medium">
              Class
            </label>

            {classes.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">
                Create a class before assigning curriculum.
              </p>
            ) : (
              <select
                id="assignment-class"
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
            )}
          </div>

          <div>
            <label htmlFor="assignment-module" className="block font-medium">
              Published module
            </label>

            {modules.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">
                No published modules are available yet.
              </p>
            ) : (
              <select
                id="assignment-module"
                value={moduleId}
                onChange={(event) => {
                  setModuleId(event.target.value)
                  setSuccess('')
                }}
                className="mt-2 block w-full rounded-md border px-3 py-2"
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title} — version {module.version}
                  </option>
                ))}
              </select>
            )}
          </div>

          {moduleId && (
            <ModuleSummary
              module={modules.find((item) => item.id === moduleId)}
            />
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="rounded-lg border p-4 font-medium">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              classes.length === 0 ||
              modules.length === 0
            }
            className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Assigning...' : 'Assign module'}
          </button>
        </form>
      )}
    </section>
  )
}

function ModuleSummary({
  module,
}: {
  module: PublishedModule | undefined
}) {
  if (!module) return null

  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="font-medium">{module.title}</p>

      {module.summary && (
        <p className="mt-1 text-sm text-gray-600">
          {module.summary}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-600">
        {module.slug} · version {module.version}
      </p>
    </div>
  )
}