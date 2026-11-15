import { useId, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { draftNoteHome } from './familyNote'
import type { StudentReport } from './report'

/** Draft a note to the family; the instructor edits, copies and sends it themselves. */
export function NoteHome({ report }: { report: StudentReport }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')

  function start() {
    setText(draftNoteHome(report))
    setStatus('')
    setOpen(true)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied. Paste it into your school messaging tool.')
    } catch {
      setStatus('Could not copy. Select the text and copy it yourself.')
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2 rounded-lg border p-4 print:hidden">
      <h3 id={`${id}-h`} className="text-lg font-semibold">Note home</h3>
      <p className="text-sm text-muted-foreground">
        A short, positive note for the family, written from this report. Nothing is sent from here: you edit it and send it yourself.
      </p>
      {!open ? (
        <Button type="button" variant="outline" className="self-start" onClick={start}>Draft a note home</Button>
      ) : (
        <>
          <Label htmlFor={`${id}-text`}>Message to the family (edit before you send it)</Label>
          <Textarea id={`${id}-text`} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void copy()}><Copy aria-hidden="true" /> Copy message</Button>
            <Button type="button" variant="outline" onClick={start}>Start over</Button>
            <span role="status" className="text-sm">{status}</span>
          </div>
        </>
      )}
    </section>
  )
}
