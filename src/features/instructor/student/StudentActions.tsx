import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { reportCsv } from './exportCsv'
import type { StudentReport } from './report'
import { allowRetake, resetLoginCode } from './studentApi'

// What an instructor can DO from the student page. Both database actions ask for confirmation first,
// and a new login code is shown once (it is never stored in the page or the URL).

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function StudentActions({
  report,
  classId,
  memberId,
  profileId,
  demo = false,
  onChanged,
}: {
  report: StudentReport
  classId: string
  memberId: string
  profileId: string | null
  demo?: boolean
  onChanged?: () => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmRetake, setConfirmRetake] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const reset = useMutation({
    mutationFn: () => resetLoginCode(memberId),
    onSuccess: () => setConfirmReset(false),
  })
  const retake = useMutation({
    mutationFn: (assessmentId: string) => allowRetake(profileId as string, classId, assessmentId),
    onSuccess: () => {
      setConfirmRetake(null)
      setMessage('Done. The student can take that test again.')
      onChanged?.()
    },
  })

  const taken = report.tests.filter((t) => t.scorePct !== null)
  const fileName = `${report.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student'}-report.csv`

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(report.noteDraft)
      setMessage('Note copied. Paste it wherever you talk with this student.')
    } catch {
      setMessage('Could not copy automatically. Select the note and copy it.')
    }
  }

  return (
    <section aria-labelledby="student-actions" className="flex flex-col gap-4 rounded-lg border p-4 print:hidden">
      <h3 id="student-actions" className="text-lg font-semibold">Actions</h3>
      {demo && <p className="text-sm text-muted-foreground">Demo mode: actions that change data are turned off.</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => download(fileName, reportCsv(report))}>Download CSV</Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>Print report</Button>
        {!confirmReset && (
          <Button type="button" variant="outline" disabled={demo} onClick={() => { reset.reset(); setConfirmReset(true) }}>Reset login code</Button>
        )}
      </div>

      {confirmReset && (
        <div role="group" aria-label="Confirm login code reset" className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-muted p-3">
          <p className="text-sm text-warning">This makes {report.name}'s old code stop working. Their progress is kept and moves to the device that uses the new code.</p>
          <div className="flex gap-2">
            <Button type="button" disabled={reset.isPending} onClick={() => reset.mutate()}>{reset.isPending ? 'Resetting…' : 'Yes, reset the code'}</Button>
            <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {reset.data && (
        <div role="status" className="rounded-md border border-success/40 bg-success-muted p-3 text-success">
          <p className="text-sm font-medium">New login code for {report.name} (shown once, write it down now):</p>
          <p className="font-mono text-2xl tracking-wider">{reset.data}</p>
        </div>
      )}
      {reset.error && <p role="alert" className="text-sm font-medium text-destructive">{reset.error.message}</p>}

      {taken.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Allow a test retake</p>
          <ul className="flex flex-col gap-2">
            {taken.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t.title}: {Math.round(t.scorePct as number)}%</span>
                {confirmRetake === t.id ? (
                  <>
                    <Button type="button" size="sm" disabled={retake.isPending} onClick={() => retake.mutate(t.id)}>{retake.isPending ? 'Working…' : 'Yes, remove this result'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRetake(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={demo || !profileId} aria-label={`Allow a retake of ${t.title}`} onClick={() => { retake.reset(); setConfirmRetake(t.id) }}>
                    Allow retake
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {retake.error && <p role="alert" className="text-sm font-medium text-destructive">{retake.error.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="note-draft">A note you could send (drafted for you; you decide whether to send it)</Label>
        <Textarea id="note-draft" readOnly rows={3} value={report.noteDraft} />
        <Button type="button" variant="outline" className="self-start" onClick={() => void copyNote()}>Copy note</Button>
      </div>

      <p role="status" className="text-sm empty:hidden">{message}</p>
    </section>
  )
}
