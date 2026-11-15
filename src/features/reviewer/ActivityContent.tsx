import { z } from 'zod'
import { questionContent, type QuestionContent } from '@shared/authoring/schemas'
import type { ReviewActivity } from './api'

// Read-only rendering of what a student sees. Nothing here shows an answer: the content
// stored with each activity never contains one (the database refuses it), and these
// components only print known fields, never raw data.

const SAFE_EMBED = /^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{6,20})$/

const VideoContent = z.object({ embedUrl: z.string(), transcript: z.string().nullish() })
const ReadingContent = z.object({ body: z.string() })
const QuestionsContent = z.object({ questions: z.array(z.unknown()) })

const TYPE_LABEL: Record<QuestionContent['type'], string> = {
  mcq: 'Multiple choice',
  short_answer: 'Short answer',
  fill_blank: 'Fill in the blank',
  ordering: 'Put in order',
  reflection: 'Reflection (not scored)',
}

function Unavailable({ what }: { what: string }) {
  return (
    <p role="note" className="text-sm text-muted-foreground">
      {what} can&apos;t be shown here.
    </p>
  )
}

export function QuestionView({ question, concepts }: { question: unknown; concepts?: Map<string, string> }) {
  const parsed = questionContent.safeParse(question)
  // A question that does not match the expected shape is left out entirely, so unexpected
  // fields (for example a stray answer) are never printed.
  if (!parsed.success) return <Unavailable what="This question" />
  const q = parsed.data
  const concept = 'conceptId' in q ? (concepts?.get(q.conceptId) ?? q.conceptId) : null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {TYPE_LABEL[q.type]}
        {concept ? ` · Concept: ${concept}` : ''}
      </p>
      <p className="whitespace-pre-wrap">{q.prompt}</p>
      {q.type === 'mcq' && (
        <ul className="flex list-none flex-col gap-1 pl-0" aria-label="Choices">
          {q.choices.map((c, i) => (
            <li key={c.id} className="rounded-md border px-3 py-2 text-sm">
              <span aria-hidden="true">{String.fromCharCode(65 + i)}. </span>
              {c.text}
            </li>
          ))}
        </ul>
      )}
      {q.type === 'ordering' && (
        <ul className="flex list-none flex-col gap-1 pl-0" aria-label="Items to put in order">
          {q.items.map((item) => (
            <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ActivityContent({
  activity,
  concepts,
}: {
  activity: ReviewActivity
  concepts?: Map<string, string>
}) {
  if (activity.kind === 'video') {
    const parsed = VideoContent.safeParse(activity.content)
    const match = parsed.success ? SAFE_EMBED.exec(parsed.data.embedUrl) : null
    if (!parsed.success || !match) return <Unavailable what="This video" />
    return (
      <div className="flex flex-col gap-3">
        <iframe
          title={`Video: ${activity.title}`}
          src={parsed.data.embedUrl}
          className="aspect-video w-full max-w-2xl rounded-md border"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        <a
          className="text-sm underline"
          href={`https://www.youtube.com/watch?v=${match[1]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on YouTube (opens in a new tab)
        </a>
        {parsed.data.transcript ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Transcript</summary>
            <p className="mt-2 whitespace-pre-wrap">{parsed.data.transcript}</p>
          </details>
        ) : null}
      </div>
    )
  }

  if (activity.kind === 'reading') {
    const parsed = ReadingContent.safeParse(activity.content)
    if (!parsed.success) return <Unavailable what="This reading" />
    // Plain text only, never HTML: the author's text is shown exactly as written.
    return <div className="max-w-2xl whitespace-pre-wrap">{parsed.data.body}</div>
  }

  const parsed = QuestionsContent.safeParse(activity.content)
  if (!parsed.success) return <Unavailable what="These questions" />
  return (
    <ol className="flex list-none flex-col gap-4 pl-0">
      {parsed.data.questions.map((q, i) => (
        <li key={i} className="rounded-lg border p-4">
          <QuestionView question={q} concepts={concepts} />
        </li>
      ))}
    </ol>
  )
}
