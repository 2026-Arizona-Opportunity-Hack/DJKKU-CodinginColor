import { useId, useState } from 'react'
import { Link } from 'react-router'
import { NotebookPen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMyNotes, useSaveNote } from '../queries'
import { NOTE_MAX } from '../types'
import { describeError } from '../errors'
import { InlineError } from './InlineError'

/**
 * "Explain it in your own words": putting an idea into your own words helps you learn it (the
 * self-explanation effect, Chi et al. 1994). Private to the student; saved when they press Save or
 * leave the box.
 */
export function NoteBox({ activityId, notebookHref }: { activityId: string; notebookHref: string }) {
  const id = useId()
  const notes = useMyNotes()
  const save = useSaveNote(activityId)
  const saved = notes.data?.find((n) => n.activity_id === activityId)?.body ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved
  const changed = draft !== null && draft.trim() !== saved
  const tooLong = value.length > NOTE_MAX

  function commit() {
    if (!changed || tooLong || save.isPending) return
    save.mutate(value, { onSuccess: () => setDraft(null) })
  }

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 print:hidden">
      <h2 id={`${id}-h`} className="flex items-center gap-2 font-semibold">
        <NotebookPen aria-hidden="true" className="size-5" /> My notebook
      </h2>
      <Label htmlFor={`${id}-note`}>Explain it in your own words</Label>
      <Textarea
        id={`${id}-note`}
        rows={3}
        value={value}
        disabled={notes.isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-invalid={tooLong}
        aria-describedby={`${id}-help`}
        placeholder="For example: a loop repeats the lines inside it, so..."
      />
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        Only you can see this. {value.length} of {NOTE_MAX} characters.
        {tooLong && <span className="font-medium text-destructive"> That is too long to save.</span>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={!changed || tooLong || save.isPending} onClick={commit}>
          {save.isPending ? 'Saving…' : 'Save note'}
        </Button>
        <span role="status" className="text-sm">
          {save.isSuccess && !changed ? 'Saved to your notebook.' : ''}
        </span>
        <Link to={notebookHref} className="ml-auto inline-flex min-h-11 items-center text-sm text-primary underline">
          Open my notebook
        </Link>
      </div>
      {save.isError && <InlineError error={describeError(save.error)} />}
      {notes.isError && <p className="text-sm">Your notes didn't load. You can still write one; it saves when you leave the box.</p>}
    </section>
  )
}
