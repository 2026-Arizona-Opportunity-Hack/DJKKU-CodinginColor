import { Link } from 'react-router'

import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QueryView } from '@/features/student/components/QueryView'
import { StatusBadge } from '@/features/student/components/StatusBadge'
import { StudentLayout } from '@/features/student/components/StudentLayout'
import { KIND_LABEL, paths } from '@/features/student/outline'
import { useOpenModules } from '@/features/student/queries'
import { useGuestProgress } from '@/features/student/useGuestProgress'

/** B3: published "CIC Open" modules, no account needed. Progress is kept on this device. */
export function ExplorePage() {
  const modules = useOpenModules()
  const [progress] = useGuestProgress()
  const doneCount = Object.keys(progress.completed).length

  return (
    <StudentLayout>
      <h1 className="text-2xl font-bold">Explore lessons</h1>
      <Card>
        <CardHeader>
          <CardTitle>You're browsing as a guest</CardTitle>
          <CardDescription>
            Your progress is saved on this device only ({doneCount} {doneCount === 1 ? 'activity' : 'activities'} done).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/explore/save">Save my progress</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/start">I have a login code</Link>
          </Button>
        </CardContent>
      </Card>
      <QueryView query={modules} label="Loading lessons">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No open lessons yet">
              <p>Check back soon.</p>
            </EmptyState>
          ) : (
            list.map((m) => (
              <Card key={m.module_id}>
                <CardHeader>
                  <CardTitle>{m.title}</CardTitle>
                  {m.summary && <CardDescription>{m.summary}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {m.lessons.map((l) => (
                    <section key={l.lesson_id} aria-labelledby={`g-${l.lesson_id}`}>
                      <h3 id={`g-${l.lesson_id}`} className="mb-2 font-semibold">
                        {l.title}
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {l.activities.map((a) => (
                          <li key={a.activity_id}>
                            <Link
                              to={paths.guestActivity(a.activity_id)}
                              className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent"
                            >
                              <span className="flex-1">
                                {a.title} <span className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]}</span>
                              </span>
                              <StatusBadge status={progress.completed[a.activity_id] ? 'done' : 'available'} />
                            </Link>
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
    </StudentLayout>
  )
}
