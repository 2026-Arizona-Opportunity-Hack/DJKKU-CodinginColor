import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Reading, VideoEmbed } from '@/components/learning/ActivityContent'
import { QuestionPreview } from '@/components/learning/QuestionPreview'
import type { QuestionContent } from '@shared/authoring/schemas'
import { loadModule, type ReviewContent } from './api'

const KIND: Record<string, string> = { video: 'Video', reading: 'Reading', check: 'Check', worksheet: 'Worksheet', exit: 'Exit ticket' }

function Content({ title, content }: { title: string; content: ReviewContent }) {
  if (content.kind === 'video') return <VideoEmbed embedUrl={content.embedUrl} title={title} transcript={content.transcript} />
  if (content.kind === 'reading') return <Reading markdown={content.body} />
  if (content.kind === 'unreadable') return <p>This activity's content could not be shown.</p>
  return <div className="flex flex-col gap-3">{content.questions.map((q, i) => <QuestionPreview key={q.id} question={q} index={i} />)}</div>
}

const Item = ({ q, label }: { q?: QuestionContent; label: string }) => (
  <div className="flex flex-col gap-1">
    <h4 className="font-medium">{label}</h4>
    {q ? <QuestionPreview question={q} index={0} /> : <p className="text-sm text-muted-foreground">No matching item on the {label.toLowerCase()}.</p>}
  </div>
)

/** `/review/:moduleId`: one published module, read-only, as a student sees it. No answers anywhere. */
export function ModuleView() {
  const { moduleId = '' } = useParams()
  const module = useQuery({ queryKey: ['review', 'module', moduleId], queryFn: () => loadModule(moduleId) })
  if (module.isPending) return <p role="status">Loading the module…</p>
  if (module.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-destructive">
        <p>{module.error.message}</p>
        <Link className="underline" to="/review">Back to published modules</Link>
      </div>
    )
  }
  const m = module.data
  return (
    <article aria-labelledby="review-title" className="flex flex-col gap-8">
      <div>
        <Link className="inline-flex min-h-11 items-center underline" to="/review">Back to published modules</Link>
        <h2 id="review-title" className="text-2xl font-semibold">{m.title} <span className="text-base font-normal text-muted-foreground">version {m.version}</span></h2>
        {m.summary && <p>{m.summary}</p>}
      </div>
      {m.lessons.map((l, li) => (
        <section key={l.id} aria-labelledby={`lesson-${l.id}`} className="flex flex-col gap-4">
          <h3 id={`lesson-${l.id}`} className="text-xl font-semibold">Lesson {li + 1}: {l.title}</h3>
          {l.activities.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <h4 className="font-semibold">{a.title}</h4>
              <p className="text-sm text-muted-foreground">{KIND[a.kind]}{a.required ? '' : ', optional'}{a.concept ? `, concept: ${a.concept}` : ''}</p>
              <Content title={a.title} content={a.content} />
            </div>
          ))}
        </section>
      ))}
      <section aria-labelledby="review-tests" className="flex flex-col gap-4">
        <h3 id="review-tests" className="text-xl font-semibold">Pre-test and post-test, by pair key</h3>
        <p className="text-sm text-muted-foreground">Items with the same pair key are compared to measure learning gain.</p>
        {m.pairs.length === 0 ? (
          <p>This module has no pre-test or post-test.</p>
        ) : (
          m.pairs.map((p) => (
            <div key={p.pairKey} className="flex flex-col gap-2 rounded-lg border p-4">
              <h4 className="font-semibold">Pair {p.pairKey} <span className="text-sm font-normal text-muted-foreground">(concept: {p.concept})</span></h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Item q={p.pre} label="Pre-test" />
                <Item q={p.post} label="Post-test" />
              </div>
            </div>
          ))
        )}
      </section>
    </article>
  )
}
