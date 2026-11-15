import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { InlineCode } from '@/components/learning/InlineCode'
import { QueryStatus } from '@/components/QueryStatus'
import { describeAnswer, share } from './radar'
import { loadMisconceptions } from './misconceptionsApi'

/**
 * `/instructor/:classId/reteach`: the questions most students got wrong on their first try, and the
 * wrong answers they actually gave. A wrong answer shared by many students is a misconception worth
 * reteaching, not a careless slip.
 */
export function Misconceptions() {
  const { classId = '' } = useParams()
  const radar = useQuery({ queryKey: ['instructor', 'misconceptions', classId], queryFn: () => loadMisconceptions(classId) })

  return (
    <article aria-labelledby="reteach-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="reteach-title" className="text-2xl font-bold">What to reteach</h1>
        <Link to={`/instructor/${classId}`} className="inline-flex min-h-11 items-center text-primary underline">Back to the class</Link>
      </div>
      <p className="max-w-prose text-muted-foreground">
        Questions where 2 or more students were wrong on their first try, most first. When many students give the
        same wrong answer, it is usually one idea to fix in a few minutes at the start of next class.
      </p>
      <QueryStatus
        query={radar}
        label="what to reteach"
        isEmpty={(rows) => rows.length === 0}
        empty={<p>Nothing to reteach yet: no question has 2 or more students wrong on their first try.</p>}
      >
        {(rows) => (
          <ol className="flex flex-col gap-4">
            {rows.map((r) => (
              <li key={`${r.activity_id}-${r.question?.id}`} className="rounded-lg border p-4">
                <h2 className="text-lg font-semibold">
                  {r.question ? <InlineCode text={r.question.prompt} /> : 'A question that was changed since'}
                </h2>
                <p className="text-sm text-muted-foreground">{r.lesson_title}, {r.activity_title}</p>
                <p className="mt-2 font-medium">{share(r.wrong, r.answered)} were wrong on their first try.</p>
                {r.answers && r.answers.length > 0 && (
                  <>
                    <h3 className="mt-2 text-sm font-semibold">Most common wrong answers</h3>
                    <ul className="list-disc pl-5">
                      {r.answers.map((a, i) => (
                        <li key={i}>
                          {a.students} {a.students === 1 ? 'student' : 'students'} <InlineCode text={describeAnswer(r.question, a.answer)} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </QueryStatus>
    </article>
  )
}
