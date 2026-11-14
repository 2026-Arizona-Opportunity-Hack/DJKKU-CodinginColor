import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { ActivityResponse, Question } from '@/shared/content'

import type { Activity } from '../types'
import { Reading, VideoEmbed } from './ActivityContent'
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
  switch (activity.kind) {
    case 'video':
    case 'reading': {
      const done = activity.status === 'done'
      return (
        <div className="flex flex-col gap-4">
          {activity.kind === 'video' ? (
            <VideoEmbed youtubeId={activity.content.youtube_id} title={activity.title} transcript={activity.content.transcript} />
          ) : (
            <Reading markdown={activity.content.markdown} />
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
    case 'check':
    case 'exit':
      return <SingleQuestion question={activity.content.question} onSubmit={onSubmit} pending={pending} actions={actions} />
    case 'worksheet':
      return (
        <QuestionForm
          questions={activity.content.items}
          submitLabel="Send worksheet"
          pending={pending}
          onSubmit={(answers) => onSubmit({ answers })}
        >
          {actions}
        </QuestionForm>
      )
  }
}

function SingleQuestion({
  question,
  onSubmit,
  pending,
  actions,
}: {
  question: Question
  onSubmit: (r: ActivityResponse) => void
  pending: boolean
  actions?: ReactNode
}) {
  return (
    <QuestionForm
      questions={[question]}
      submitLabel="Check my answer"
      pending={pending}
      onSubmit={(responses) => {
        const r = responses[question.id]
        if (r) onSubmit(r)
      }}
    >
      {actions}
    </QuestionForm>
  )
}
