import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, NotebookPen } from 'lucide-react'

import { ErrorState } from '@/features/player/components/states'
import { Button } from '@/components/ui/button'
import { env } from '@/features/player/env'
import type { ActivityResponse } from '@/features/player/content'
import { ActivityBody } from '@/features/player/components/ActivityBody'
import { useNotesPanel } from '@/features/player/notesPanel'
import { HintPanel } from '@/features/player/components/HintPanel'
import { QueryView } from '@/features/player/components/QueryView'
import { ResultMessage } from '@/features/player/components/ResultMessage'
import { InlineError } from '@/features/player/components/InlineError'
import { describeError, isApiError } from '@/features/player/errors'
import { KIND_LABEL, locate, needsPretest, paths } from '@/features/player/outline'
import { useActivity, useOutline, useSubmitAnswer } from '@/features/player/queries'
import type { Activity } from '@/features/player/types'
import { useHeartbeat } from '@/features/player/useHeartbeat'

/** B7 gate + B8 player: `/learn/:classId/a/:activityId`. */
export function ActivityPage({ hintsEnabled = env.hintsEnabled }: { hintsEnabled?: boolean }) {
  const { classId = '', activityId = '' } = useParams()
  const outline = useOutline(classId)
  const activity = useActivity(activityId)

  // Pretest gate (B7): the outline says whether this module's pretest is taken.
  const found = outline.data ? locate(outline.data, activityId) : null
  if (found && needsPretest(found.module) && found.module.pretest) {
    return <Navigate to={paths.test(classId, found.module.pretest.assessment_id)} replace />
  }

  if (activity.isError && isApiError(activity.error) && activity.error.code === 'locked') {
    return (
      <ErrorState title="Not open yet" message={found?.activity.locked_reason ?? describeError(activity.error).message}>
        <Button asChild variant="secondary">
          <Link to={paths.path(classId)}>Back to your path</Link>
        </Button>
      </ErrorState>
    )
  }

  return (
    <QueryView query={activity} label="Loading the activity">
      {(a) => (
        <article className="flex flex-col gap-4 rounded-2xl border border-white/80 bg-card p-5 shadow-md ring-1 ring-foreground/5 sm:p-8" aria-labelledby="activity-title">
          <Link to={paths.path(classId)} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
            <ArrowLeft aria-hidden="true" className="size-4" /> Your path
          </Link>
          <header>
            <p className="eyebrow">
              {found ? `${found.module.title} · ${found.lesson.title} · ` : ''}
              {KIND_LABEL[a.kind]}
            </p>
            <h1 id="activity-title" className="text-2xl font-bold">
              {a.title}
            </h1>
          </header>
          {/* key: a fresh player (and form) per activity */}
          <Player key={a.activity_id} classId={classId} activity={a} hintsEnabled={hintsEnabled} />
        </article>
      )}
    </QueryView>
  )
}

function Player({ classId, activity, hintsEnabled }: { classId: string; activity: Activity; hintsEnabled: boolean }) {
  const submit = useSubmitAnswer(activity.activity_id)
  const { open: notesOpen, setOpen: setNotesOpen } = useNotesPanel()
  const [lastResponse, setLastResponse] = useState<ActivityResponse | null>(null)
  // Hints stay available (with their count) across retries once an answer was wrong.
  const [wrongOnce, setWrongOnce] = useState(false)
  useHeartbeat(activity.activity_id, true)

  const result = submit.data
  const failure = submit.isError ? describeError(submit.error) : null
  const nextId = result?.completed ? result.next_activity_id : activity.status === 'done' ? activity.next_id : null
  const finished = result?.completed || activity.status === 'done'

  const nextAction = finished && (
    <Button asChild size="lg" variant={nextId ? 'default' : 'outline'}>
      <Link to={nextId ? paths.activity(classId, nextId) : paths.path(classId)}>
        {nextId ? 'Next' : 'Back to your path'} <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )

  return (
    <>
      <ActivityBody
        activity={activity}
        pending={submit.isPending}
        actions={nextAction}
        onSubmit={(r) => {
          setLastResponse(r)
          submit.mutate(r, { onSuccess: (res) => res.is_correct === false && setWrongOnce(true) })
        }}
      />
      <div aria-live="polite" className="flex flex-col gap-3">
        {result && <ResultMessage result={result} />}
        {failure && (
          <InlineError error={failure} />
        )}
      </div>
      {hintsEnabled && wrongOnce && !result?.completed && lastResponse && (
        <HintPanel activityId={activity.activity_id} lastResponse={lastResponse} />
      )}
      {!notesOpen && (
        <Button type="button" variant="outline" className="self-start" onClick={() => setNotesOpen(true)}>
          <NotebookPen aria-hidden="true" /> Take notes on this
        </Button>
      )}
    </>
  )
}
