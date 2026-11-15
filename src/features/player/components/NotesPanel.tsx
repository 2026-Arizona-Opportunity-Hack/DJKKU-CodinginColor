import { Link, useMatch } from 'react-router'
import { NotebookPen, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useNotesPanel } from '../notesPanel'
import { paths } from '../outline'
import { useActivity, useMyNotes } from '../queries'
import { NoteBox } from './NoteBox'

/**
 * The notes side panel. Opens from "Notes" in the student bar and stays open while the student moves
 * between activities, so they can take notes while they study. Beside the lesson on wide screens, a
 * bottom sheet on phones. Not a dialog: the lesson stays usable.
 */
export function NotesPanel({ classId }: { classId: string }) {
  const { setOpen } = useNotesPanel()
  const match = useMatch('/learn/:classId/a/:activityId')
  const activityId = match?.params.activityId
  const activity = useActivity(activityId ?? '', false, Boolean(activityId))
  const notes = useMyNotes()
  const others = (notes.data ?? []).filter((n) => n.activity_id !== activityId).slice(-5).reverse()

  return (
    <aside
      id="notes-panel"
      aria-labelledby="notes-panel-title"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[42vh] flex-col gap-3 overflow-y-auto border-t bg-background p-3 lg:gap-4 lg:p-4 shadow-lg print:hidden lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:rounded-lg lg:border lg:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="notes-panel-title" className="flex items-center gap-2 text-lg font-semibold">
          <NotebookPen aria-hidden="true" className="size-5" /> My notes
        </h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Close notes" onClick={() => setOpen(false)}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="hidden text-sm text-muted-foreground lg:block">Only you can see your notes. They save as you type.</p>

      {activityId ? (
        <NoteBox key={activityId} activityId={activityId} activityTitle={activity.data?.title} />
      ) : (
        <p>Open an activity to write notes about it. Your notes stay here as you move through the lesson.</p>
      )}

      {others.length > 0 && (
        <section aria-labelledby="notes-recent" className="flex flex-col gap-2 border-t pt-3">
          <h3 id="notes-recent" className="font-semibold">Recent notes</h3>
          <ul className="flex flex-col gap-2">
            {others.map((n) => (
              <li key={n.activity_id} className="rounded-md border p-2 text-sm">
                <Link to={paths.activity(classId, n.activity_id)} className="font-medium text-primary underline">{n.activity_title}</Link>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link to={paths.notebook(classId)} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">
        Open my whole notebook
      </Link>
    </aside>
  )
}
