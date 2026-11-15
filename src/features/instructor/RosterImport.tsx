import { useState, type ChangeEvent } from 'react'

import { importRoster, type ImportedRosterMember } from './api.supabase'
import { checkRoster, type RosterPreview } from './lib/roster'

/** Imports a roster into the class chosen at the top of the page (no class picker of its own). */
export function RosterImport({
  classId,
  className,
  onImported,
  onPrint,
}: {
  classId: string
  className: string
  /** Called with the new login codes. They are only ever kept in memory. */
  onImported: (members: ImportedRosterMember[]) => void
  onPrint: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<RosterPreview | null>(null)
  const [error, setError] = useState('')

  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<ImportedRosterMember[]>([])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setError('')
    setPreview(null)
    setImported([])

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file.')
      return
    }

    try {
      const text = await file.text()
      setPreview(checkRoster(text))
    } catch {
      setError('We could not read that file. Try another CSV.')
    }
  }

  async function handleImport() {
    if (!classId || !preview || preview.valid.length === 0) return

    setImporting(true)
    setError('')
    setImported([])

    try {
      const result = await importRoster(classId, preview.valid)
      setImported(result)
      onImported(result)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not import this roster.',
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <section aria-labelledby="roster-heading" className="space-y-6">
      <div>
        <h2 id="roster-heading" className="text-2xl font-semibold">
          Import student roster
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Upload a CSV with one student name per row. Do not include student
          email addresses or other personal information.
        </p>
      </div>

      <div className="rounded-lg border p-5">
        <p className="font-medium">
          Importing into: <span className="font-semibold">{className}</span>
        </p>

        <label htmlFor="roster-file" className="mt-5 block font-medium">
          Roster CSV
        </label>

        <input
          id="roster-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="mt-3 block w-full"
        />

        {fileName && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {fileName}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>

      {preview && (
        <div className="space-y-6" aria-live="polite">
          <div className="flex flex-wrap gap-3">
            <span className="rounded-md border px-3 py-2 text-sm">
              {preview.valid.length} ready to import
            </span>

            <span className="rounded-md border px-3 py-2 text-sm">
              {preview.problems.length} need attention
            </span>
          </div>

          {preview.valid.length > 0 && (
            <section aria-labelledby="valid-students-heading">
              <h3 id="valid-students-heading" className="text-lg font-semibold">
                Ready to import
              </h3>

              <ul className="mt-2 divide-y rounded-lg border">
                {preview.valid.map((name) => (
                  <li key={name} className="p-3">
                    <span aria-hidden="true">✓ </span>
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.problems.length > 0 && (
            <section aria-labelledby="roster-problems-heading">
              <h3
                id="roster-problems-heading"
                className="text-lg font-semibold"
              >
                Needs attention
              </h3>

              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="p-3">
                        Line
                      </th>
                      <th scope="col" className="p-3">
                        Name
                      </th>
                      <th scope="col" className="p-3">
                        Problem
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.problems.map((problem) => (
                      <tr
                        key={`${problem.line}-${problem.name}`}
                        className="border-b"
                      >
                        <td className="p-3">{problem.line}</td>
                        <td className="p-3">{problem.name || '—'}</td>
                        <td className="p-3">{problem.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {preview.valid.length > 0 && imported.length === 0 && (
            <div>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || preview.problems.length > 0}
                className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing
                  ? 'Importing...'
                  : `Import ${preview.valid.length} students`}
              </button>

              {preview.problems.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  Fix the roster problems before importing.
                </p>
              )}
            </div>
          )}

          {imported.length > 0 && (
            <section
              aria-labelledby="login-codes-heading"
              className="rounded-lg border p-5"
            >
              <h3 id="login-codes-heading" className="text-lg font-semibold">
                Student login codes
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Save or print these codes now. Each code is shown only once.
              </p>

              <button
                type="button"
                onClick={onPrint}
                className="mt-3 rounded-md border px-4 py-2 font-medium"
              >
                Print login sheet
              </button>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="p-3">
                        Student
                      </th>
                      <th scope="col" className="p-3">
                        Login code
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {imported.map((member) => (
                      <tr key={member.member_id} className="border-b">
                        <td className="p-3">{member.display_name}</td>
                        <td className="p-3 font-mono font-semibold">
                          {member.login_code}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  )
}