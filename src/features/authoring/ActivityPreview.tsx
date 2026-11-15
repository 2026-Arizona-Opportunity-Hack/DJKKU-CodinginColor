import { Reading, VideoEmbed } from '@/components/learning/ActivityContent'
import { CodePreview } from '@/components/learning/CodePreview'
import { QuestionPreview } from '@/components/learning/QuestionPreview'
import { parseYouTubeId, splitQuestion, youtubeEmbedUrl } from '@shared/authoring/schemas'
import type { ActivityFV } from './formTypes'

/**
 * What a student would see. Questions go through splitQuestion first, exactly as when saving, so
 * only student-safe content (never an answer key) reaches the preview.
 */
export function ActivityPreview({ activity }: { activity: ActivityFV }) {
  if (activity.kind === 'video') {
    const id = parseYouTubeId(activity.youtubeUrl ?? '')
    return id ? <VideoEmbed embedUrl={youtubeEmbedUrl(id)} title={activity.title || 'Video'} transcript={activity.transcript} /> : <p>Add a YouTube link to preview the video.</p>
  }
  if (activity.kind === 'reading') return activity.body?.trim() ? <Reading markdown={activity.body} /> : <p>Write the reading to preview it.</p>
  if (activity.kind === 'code') {
    return <CodePreview content={{ prompt: activity.prompt ?? '', starter: activity.starter ?? '', predict: activity.predict, tests: activity.tests ?? [] }} />
  }
  const questions = activity.questions ?? []
  if (questions.length === 0) return <p>Add a question to preview it.</p>
  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => {
        try {
          return <QuestionPreview key={q.content.id} question={splitQuestion(q).content} index={i} />
        } catch {
          return <p key={q.content.id} className="text-sm">Question {i + 1}: finish it to see the preview.</p>
        }
      })}
    </div>
  )
}
