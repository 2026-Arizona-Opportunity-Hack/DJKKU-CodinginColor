import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

import type { ActivityResponse } from '../content'
import type { Activity } from '../types'
import { Reading, VideoEmbed } from '@/components/learning/ActivityContent'
import { QuestionForm } from './QuestionForm'

type Props = {
  activity: Activity
  onSubmit: (response: ActivityResponse) => void
  pending: boolean
  /** Rendered next to the submit button (e.g. "Next"). */
  actions?: ReactNode
}

/** The content of any activity kind plus its one submit control (B8). Knows nothing about where answers go. */
export function ActivityBody({ activity, onSubmit, pending, actions }: Props) {
  if (activity.kind === 'video' || activity.kind === 'reading') {
    const done = activity.status === 'done'
    return (
      <div className="flex flex-col gap-4">
        {activity.kind === 'video' ? (
          <VideoEmbed embedUrl={activity.content.embedUrl} title={activity.title} transcript={activity.content.transcript} />
        ) : (
          <Reading markdown={activity.content.body} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!done && (
            <Button size="lg" disabled={pending} onClick={() => onSubmit({ viewed: true })}>
              {pending ? 'Saving…' : activity.kind === 'video' ? "I've watched it" : "I've read it"}
            </Button>
          )}
          {actions}
        </div>
      </div>
    )
  }
  const { questions } = activity.content
  const label = activity.kind === 'worksheet' ? 'Send worksheet' : questions.length > 1 ? 'Check my answers' : 'Check my answer'
  return (
    <QuestionForm questions={questions} submitLabel={label} pending={pending} onSubmit={(answers) => onSubmit({ answers })}>
      {actions}
    </QuestionForm>
  )
}
