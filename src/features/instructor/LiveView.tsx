import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AlertTriangle, Check, Circle, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildGrid, CELL_LABEL, countsPerActivity, initials, type CellState } from './live'
import { loadLive } from './liveApi'

const REFRESH_MS = 20_000
const CELL: Record<CellState, { Icon: typeof Check; cls: string }> = {
  done: { Icon: Check, cls: 'bg-success-muted text-success' },
  working: { Icon: Circle, cls: 'bg-secondary text-secondary-foreground' },
  stuck: { Icon: AlertTriangle, cls: 'bg-warning-muted text-warning' },
  not_started: { Icon: Minus, cls: 'text-muted-foreground' },
}
const REASON: Record<string, string> = { wrong_attempts: '3 or more wrong tries', long_time: 'over 10 minutes on one activity', inactive: 'no activity for 3 school days' }

/** `/instructor/:classId/live`: for the projector or the teacher's laptop during class. Refreshes itself. */
export function LiveView() {
  const id = useId()
  const { classId = '' } = useParams()
  const [paused, setPaused] = useState(false)
  const [showNames, setShowNames] = useState(false)
  const live = useQuery({ queryKey: ['instructor', 'live', classId], queryFn: () => loadLive(classId), refetchInterval: paused ? false : REFRESH_MS })

  if (live.isPending) return <p role="status">Loading the live view…</p>
  if (live.isError && !live.data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-red-700">
        <p>We could not load the live view. {live.error.message}</p>
        <Button variant="outline" onClick={() => void live.refetch()}>Try again</Button>
      </div>
    )
  }
  const { activities, students, progress, stuck } = live.data
  const rows = buildGrid(activities, students, progress, stuck)
  const counts = countsPerActivity(rows, activities)
  const label = (name: string) => (showNames ? name : initials(name))
  const needHelp = rows.filter((r) => r.stuck)
  const updated = new Date(live.dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex min-h-11 items-center underline" to={`/instructor/${classId}`}>Back to the class</Link>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
            Show full names
          </label>
          <Button variant="outline" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Resume updates' : 'Pause updates'}</Button>
        </div>
      </div>
      <div>
        <h2 id={`${id}-title`} className="text-3xl font-bold">Live class view</h2>
        <p role="status" className="text-sm text-muted-foreground">
          {paused ? 'Paused.' : `Updates every ${REFRESH_MS / 1000} seconds.`} Last updated {updated}.
          {live.isError ? ' The last update failed; showing the previous one.' : ''}
        </p>
        {!showNames && <p className="text-sm text-muted-foreground">Names are shown as initials so the screen can be projected.</p>}
      </div>

      {activities.length === 0 || students.length === 0 ? (
        <p>{activities.length === 0 ? 'No module is assigned to this class yet.' : 'No student has signed in yet. Share the class link or the login sheet.'}</p>
      ) : (
        <>
          <section aria-labelledby={`${id}-help`} className="rounded-lg border-2 border-warning/40 p-4">
            <h3 id={`${id}-help`} className="text-xl font-semibold">Needs help now ({needHelp.length})</h3>
            {needHelp.length === 0 ? (
              <p>Nobody is flagged as stuck right now.</p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {needHelp.map((r) => {
                  const s = stuck.find((x) => x.student_id === r.student.id)!
                  const where = activities.find((a) => a.id === s.activity_id)?.title
                  return (
                    <li key={r.student.id} className="rounded-md bg-warning-muted p-3 text-warning">
                      <p className="text-lg font-bold">{label(r.student.name)}</p>
                      <p>{where ? `On "${where}"` : 'Not active lately'}: {s.reasons.map((x) => REASON[x] ?? x).join(', ')}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <caption className="sr-only">Each student's status on each required activity, in order</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 bg-background p-2 text-left">Student</th>
                  {counts.map(({ activity: a, working, done }, i) => (
                    <th key={a.id} scope="col" className="min-w-24 p-2 text-left align-bottom font-medium">
                      <span className="block text-xs text-muted-foreground">{i + 1}. {a.module} · {a.lesson}</span>
                      {a.title}
                      <span className="block text-xs font-normal text-muted-foreground">{working} here, {done} done</span>
                    </th>
                  ))}
                  <th scope="col" className="p-2 text-left">Done</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student.id} className="border-t">
                    <th scope="row" className="sticky left-0 bg-background p-2 text-left text-base font-semibold">{label(r.student.name)}</th>
                    {r.cells.map((c, i) => {
                      const { Icon, cls } = CELL[c]
                      return (
                        <td key={activities[i]!.id} className={`p-2 ${cls}`}>
                          <span className="flex items-center gap-1">
                            <Icon aria-hidden="true" className="size-4" />
                            <span className="text-xs">{CELL_LABEL[c]}</span>
                          </span>
                        </td>
                      )
                    })}
                    <td className="p-2 font-semibold">{r.done} of {activities.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
