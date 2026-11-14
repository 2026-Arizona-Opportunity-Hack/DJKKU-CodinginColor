import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ActivityBody } from '@/features/player/components/ActivityBody'
import { QueryView } from '@/features/player/components/QueryView'
import { StudentLayout } from '@/features/player/components/StudentLayout'
import { KIND_LABEL, paths } from '@/features/player/outline'
import { useActivity } from '@/features/player/queries'
import { useGuestProgress } from '@/features/player/useGuestProgress'

/**
 * B3: a guest opens an open activity. Nothing is sent to the server: finishing it marks it
 * done on this device. Answers aren't graded for guests (no account to grade against);
 * "Save my progress" turns this into a real account.
 */
export function GuestActivityPage() {
  const { activityId = '' } = useParams()
  const activity = useActivity(activityId, true)
  const [progress, markDone] = useGuestProgress()
  const done = Boolean(progress.completed[activityId])

  return (
    <StudentLayout>
      <Link to={paths.explore} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> All open lessons
      </Link>
      <QueryView query={activity} label="Loading the activity">
        {(a) => (
          <article key={a.activity_id} className="flex flex-col gap-4" aria-labelledby="activity-title">
            <header>
              <p className="text-sm text-muted-foreground">{KIND_LABEL[a.kind]} · Guest</p>
              <h1 id="activity-title" className="text-2xl font-bold">
                {a.title}
              </h1>
            </header>
            <ActivityBody
              activity={{ ...a, status: done ? 'done' : 'available' }}
              pending={false}
              onSubmit={() => markDone(a.activity_id)}
              actions={
                done && (
                  <Button asChild size="lg" variant={a.next_id ? 'default' : 'outline'}>
                    <Link to={a.next_id ? paths.guestActivity(a.next_id) : paths.explore}>
                      {a.next_id ? 'Next' : 'All open lessons'} <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                )
              }
            />
            <div aria-live="polite">
              {done && (
                <Alert>
                  <Info aria-hidden="true" />
                  <AlertTitle>Saved on this device</AlertTitle>
                  <AlertDescription>
                    <p>Guests don't get answers checked. Save your progress to get feedback and keep your work.</p>
                    <Button asChild variant="outline">
                      <Link to={paths.save}>Save my progress</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </article>
        )}
      </QueryView>
    </StudentLayout>
  )
}
