import { Link } from 'react-router'

import { EmptyState } from '@/features/player/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QueryView } from '@/features/player/components/QueryView'
import { StatusBadge } from '@/features/player/components/StatusBadge'
import { StudentLayout } from '@/features/player/components/StudentLayout'
import { KIND_LABEL, paths } from '@/features/player/outline'
import { useOpenModules } from '@/features/player/queries'
import { useGuestProgress } from '@/features/player/useGuestProgress'
import { useViewer } from '@/features/player/useViewer'

/**
 * B3: published "CIC Open" modules, no account needed. Guests keep progress on this device.
 * Signed in, it is practice: no guest prompts, no device-only "Done" badges, a way back to class work.
 */
export function ExplorePage() {
  const modules = useOpenModules()
  const [progress] = useGuestProgress()
  const viewer = useViewer()
  const doneCount = Object.keys(progress.completed).length

  return (
    <StudentLayout me={viewer.me}>
      <h1 className="text-2xl font-bold">Explore lessons</h1>
      {viewer.me && (
        <Card>
          <CardHeader>
            <CardTitle>Open lessons for practice</CardTitle>
            <CardDescription>
              Anyone can try these. They aren't checked or added to your class progress
              {viewer.student ? '; your class work is under Start here.' : '.'}
            </CardDescription>
          </CardHeader>
          {viewer.student && (
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={paths.home}>Go to Start here</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      )}
      {viewer.guest && (
      <Card>
        <CardHeader>
          <CardTitle>You're browsing as a guest</CardTitle>
          <CardDescription>
            Your progress is saved on this device only ({doneCount} {doneCount === 1 ? 'activity' : 'activities'} done).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={paths.save}>Save my progress</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={paths.signIn}>I have a login code</Link>
          </Button>
        </CardContent>
      </Card>
      )}
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
                              className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3 py-2 transition-colors hover:border-tint-green-edge hover:bg-tint-green/60"
                            >
                              <span className="flex-1 font-display font-bold">
                                {a.title} <span className="font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">{KIND_LABEL[a.kind]}</span>
                              </span>
                              {viewer.guest && <StatusBadge status={progress.completed[a.activity_id] ? 'done' : 'available'} />}
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
