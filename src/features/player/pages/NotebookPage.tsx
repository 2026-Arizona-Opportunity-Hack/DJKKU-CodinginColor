import { Link, useParams } from 'react-router'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/features/player/components/states'
import { QueryView } from '@/features/player/components/QueryView'
import { paths } from '@/features/player/outline'
import { useMyNotes } from '@/features/player/queries'
import { groupNotes } from '@/features/player/notebook'

/** Everything the student wrote in their own words, to review before the post-test. Printable. */
export function NotebookPage() {
  const { classId = '' } = useParams()
  const notes = useMyNotes()

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">My notebook</h1>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden="true" /> Print or save as PDF
          </Button>
          <Link to={paths.path(classId)} className="inline-flex min-h-11 items-center text-primary underline">
            Back to your path
          </Link>
        </div>
      </div>
      <p className="text-muted-foreground">Only you can see your notebook. Read it again before a test: it is in your own words.</p>
      <QueryView query={notes} label="Loading your notebook">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No notes yet">
              <p>Under every activity there is a box to explain it in your own words. What you write shows up here.</p>
            </EmptyState>
          ) : (
            groupNotes(list).map((m) => (
              <Card key={m.module}>
                <CardHeader>
                  <CardTitle>{m.module}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {m.lessons.map((l) => (
                    <section key={l.lesson} className="flex flex-col gap-2">
                      <h3 className="font-semibold">{l.lesson}</h3>
                      <ul className="flex flex-col gap-3">
                        {l.notes.map((n) => (
                          <li key={n.activity_id} className="break-inside-avoid rounded-md border p-3">
                            <Link to={paths.activity(classId, n.activity_id)} className="font-medium text-primary underline">
                              {n.activity_title}
                            </Link>
                            <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </CardContent>
              </Card>
            ))
          )
        }
      </QueryView>
    </>
  )
}
