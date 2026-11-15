import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { NotebookPen } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { Me } from '../api'
import { NotesPanelContext } from '../notesPanel'
import { paths } from '../outline'
import { useSignOut } from '../queries'
import { NotesPanel } from './NotesPanel'

/**
 * Lane B page body. The app Layout already provides the skip link, nav and the only
 * <main>; this adds the "Signed in as … / Not you? Sign out" bar (ADR 0004).
 */
export function StudentLayout({ me, children }: { me?: Me | null; children: ReactNode }) {
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [notesOpen, setNotesOpen] = useState(false)
  const classId = me?.class_id ?? null
  const showNotes = notesOpen && classId !== null

  return (
    <NotesPanelContext.Provider value={{ open: showNotes, setOpen: setNotesOpen }}>
    <div className={showNotes ? 'mx-auto grid max-w-6xl gap-6 pb-[44vh] lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0' : 'mx-auto max-w-3xl'}>
    <div className="flex min-w-0 flex-col gap-6">
      {me && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground shadow-xs [&_strong]:text-foreground">
          <span>
            {me.display_name ? (
              <>
                Signed in as <strong>{me.display_name}</strong>
              </>
            ) : (
              'Signed in'
            )}
          </span>
          <span className="flex flex-wrap items-center gap-2">
          {classId !== null && (
            <Button
              variant={showNotes ? 'default' : 'outline'}
              size="sm"
              aria-expanded={showNotes}
              aria-controls="notes-panel"
              onClick={() => setNotesOpen(!showNotes)}
            >
              <NotebookPen aria-hidden="true" /> Notes
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate(undefined, { onSettled: () => navigate(paths.signIn) })}
          >
            Not you? Sign out
          </Button>
          </span>
        </div>
      )}
      {children}
    </div>
    {showNotes && <NotesPanel classId={classId} />}
    </div>
    </NotesPanelContext.Provider>
  )
}
