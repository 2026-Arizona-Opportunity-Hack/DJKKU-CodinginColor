import { useState, type ChangeEvent } from 'react'
import {
  checkRoster,
  type RosterPreview,
} from './lib/roster'

export function RosterImport() {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<RosterPreview | null>(null)
  const [error, setError] = useState('')

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    setError('')
    setPreview(null)

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
        <label htmlFor="roster-file" className="block font-medium">
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

          {preview.valid.length > 0 && (
            <div>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-md border px-4 py-2 font-medium opacity-60"
                title="Database integration is not available yet"
              >
                Import {preview.valid.length} students
              </button>

              <p className="mt-2 text-sm text-gray-600">
                Import will be enabled when class storage is connected.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}