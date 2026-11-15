import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { slugify } from '@shared/authoring/schemas'
import { buildReport, reportCsv, type GainLine, type ModuleReport } from './report'
import { loadReport } from './reportApi'

const pct = (n: number | null) => (n === null ? 'Incomplete' : `${Math.round(n)}%`)
const gain = (n: number | null) => (n === null ? 'Incomplete' : `${n > 0 ? '+' : ''}${Math.round(n)} pts`)

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border p-4 break-inside-avoid">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** Pre and post side by side as bars. Decorative: the table below holds the same numbers for everyone. */
function Bars({ lines }: { lines: GainLine[] }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {lines.map((l) => (
        <div key={l.label} className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm">
          <span className="truncate font-medium">{l.label}</span>
          <div className="flex flex-col gap-1">
            {(['pre', 'post'] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-8 text-xs text-muted-foreground">{k === 'pre' ? 'Pre' : 'Post'}</span>
                <div className="h-3 flex-1 rounded-full bg-muted">
                  <div className={`h-3 rounded-full ${k === 'pre' ? 'bg-muted-foreground/60' : 'bg-primary'}`} style={{ width: `${Math.max(0, Math.min(100, l[k] ?? 0))}%` }} />
                </div>
                <span className="w-10 text-right text-xs">{pct(l[k])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ModuleSection({ className, m }: { className: string; m: ModuleReport }) {
  const lines = [...(m.overall ? [m.overall] : []), ...m.concepts]
  return (
    <section aria-labelledby={`mod-${m.moduleId}`} className="flex flex-col gap-4">
      <h3 id={`mod-${m.moduleId}`} className="text-xl font-semibold">{m.title}</h3>
      <p className="rounded-lg border-l-4 border-primary bg-secondary p-4 text-lg font-medium text-secondary-foreground">{m.headline}</p>
      {m.smallGroup && m.overall && m.overall.measured > 0 && (
        <p className="text-sm">Fewer than 5 students have both tests, so treat these numbers with care. CIC's read API leaves groups this small out.</p>
      )}
      {m.overall && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Pre-test average" value={pct(m.overall.pre)} />
          <Kpi label="Post-test average" value={pct(m.overall.post)} />
          <Kpi label="Learning gain" value={gain(m.overall.gain)} note="post minus pre, in points" />
          <Kpi
            label="Normalized gain"
            value={m.overall.normalizedGain === null ? 'Incomplete' : `${Math.round(m.overall.normalizedGain * 100)}%`}
            note="share of the possible improvement achieved"
          />
        </div>
      )}
      {lines.length > 0 && <Bars lines={lines} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Learning gain for {m.title}, by concept</caption>
          <thead>
            <tr className="border-b">{['Concept', 'Pre-test', 'Post-test', 'Gain', 'Normalized gain', 'Students measured', 'Missing a test'].map((h) => <th key={h} scope="col" className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b">
                <th scope="row" className="p-2 font-medium">{l.conceptId === null ? 'All concepts' : l.label}</th>
                <td className="p-2">{pct(l.pre)}</td>
                <td className="p-2">{pct(l.post)}</td>
                <td className="p-2">{gain(l.gain)}</td>
                <td className="p-2">{l.normalizedGain === null ? 'Incomplete' : `${Math.round(l.normalizedGain * 100)}%`}</td>
                <td className="p-2">{l.measured}</td>
                <td className="p-2">{l.incomplete}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" className="self-start print:hidden" onClick={() => download(`impact-${slugify(className) || 'class'}-${slugify(m.title) || 'module'}.csv`, reportCsv(className, m))}>
        Download CSV ({m.title})
      </Button>
    </section>
  )
}

/** `/instructor/:classId/report`: a one-page, printable learning-gain report for funders. Class totals only. */
export function ImpactReport() {
  const id = useId()
  const { classId = '' } = useParams()
  const data = useQuery({ queryKey: ['instructor', 'report', classId], queryFn: () => loadReport(classId) })
  const [moduleId, setModuleId] = useState('')
  const [generated] = useState(() => new Date().toLocaleDateString([], { dateStyle: 'long' }))

  if (data.isPending) return <p role="status">Loading the report…</p>
  if (data.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-red-700">
        <p>We could not load the report. {data.error.message}</p>
        <Button variant="outline" onClick={() => void data.refetch()}>Try again</Button>
      </div>
    )
  }
  const d = data.data
  const modules = buildReport(d.className, d.rows, d.moduleTitles, d.conceptNames)
  const shown = modules.find((m) => m.moduleId === moduleId) ?? modules[0]

  return (
    <article aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="inline-flex min-h-11 items-center underline" to={`/instructor/${classId}`}>Back to the class</Link>
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Coding in Color impact report</p>
        <h2 id={`${id}-title`} className="text-3xl font-bold">{d.className}</h2>
        <p className="text-sm">
          {[d.school, d.term].filter(Boolean).join(', ')}
          {d.school || d.term ? ' · ' : ''}Generated {generated}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Students signed in" value={String(d.students)} />
        <Kpi label="Average completion" value={d.avgCompletion === null ? 'No students yet' : `${Math.round(d.avgCompletion)}%`} note="of the required activities assigned so far" />
        <Kpi label="Modules with test results" value={String(modules.length)} />
      </div>

      {modules.length === 0 ? (
        <p>No pre-test or post-test results yet. The report fills in once students take both tests of a module.</p>
      ) : (
        <>
          {modules.length > 1 && (
            <div className="flex flex-col gap-1 print:hidden">
              <Label htmlFor={`${id}-module`}>Module</Label>
              <select id={`${id}-module`} value={shown!.moduleId} onChange={(e) => setModuleId(e.target.value)} className="min-h-11 max-w-md rounded-md border bg-background px-3 py-2">
                {modules.map((m) => <option key={m.moduleId} value={m.moduleId}>{m.title}</option>)}
              </select>
            </div>
          )}
          <ModuleSection className={d.className} m={shown!} />
        </>
      )}

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        How this is measured: learning gain is the post-test score minus the pre-test score, for students who took
        both. A student missing a test is counted as missing, never as zero. Normalized gain is the gain divided by
        the room left to improve (100 minus the pre-test score). Per concept, only matching pre and post questions
        are compared. No student's name or score appears in this report.
      </footer>
    </article>
  )
}
