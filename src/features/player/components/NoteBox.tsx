import { useEffect, useId, useRef, useState } from 'react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { describeError } from '../errors'
import { useMyNotes, useSaveNote } from '../queries'
import { NOTE_MAX } from '../types'
import { InlineError } from './InlineError'

const AUTOSAVE_MS = 1200

/**
 * "Explain it in your own words" for one activity: putting an idea into your own words helps you learn it
 * (the self-explanation effect, Chi et al. 1994). Private to the student. Saves by itself a moment after
 * they stop typing, when they leave the box, and when they move to another activity.
 */
export function NoteBox({ activityId, activityTitle }: { activityId: string; activityTitle?: string }) {
  const id = useId()
  const notes = useMyNotes()
  const save = useSaveNote(activityId)
  const saved = notes.data?.find((n) => n.activity_id === activityId)?.body ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved
  const changed = draft !== null && draft.trim() !== saved
  const tooLong = value.length > NOTE_MAX

  // Always save the latest text, including when the student moves on before the timer fires.
  const pending = useRef<string | null>(null)
  const mutate = useRef(save.mutate)
  const latest = changed && !tooLong ? value : null
  useEffect(() => {
    pending.current = latest
    mutate.current = save.mutate
  })

  function commit() {
    if (latest === null || save.isPending) return
    save.mutate(latest)
  }

  useEffect(() => {
    if (!changed || tooLong) return
    const t = setTimeout(() => { if (pending.current !== null && pending.current === latest) mutate.current(pending.current) }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [latest, changed, tooLong])

  useEffect(() => () => { if (pending.current !== null) mutate.current(pending.current) }, [])

  const status = tooLong ? '' : save.isPending ? 'Saving…' : changed ? 'Not saved yet' : save.isSuccess ? 'Saved' : ''

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-note`}>
        {activityTitle ? `Notes on "${activityTitle}"` : 'Explain it in your own words'}
      </Label>
      <Textarea
        id={`${id}-note`}
        rows={4}
        className="lg:min-h-48"
        value={value}
        disabled={notes.isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-invalid={tooLong}
        aria-describedby={`${id}-help`}
        placeholder="Explain it in your own words. For example: a loop repeats the lines inside it, so..."
      />
      <p id={`${id}-help`} className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {value.length} of {NOTE_MAX} characters.
          {tooLong && <span className="font-medium text-destructive"> That is too long to save.</span>}
        </span>
        <span role="status">{status}</span>
      </p>
      {save.isError && <InlineError error={describeError(save.error)} />}
      {notes.isError && <p className="text-sm">Your notes didn't load. What you write still saves.</p>}
    </div>
  )
}
