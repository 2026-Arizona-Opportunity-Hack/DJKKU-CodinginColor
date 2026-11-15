import { Link, useParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityContent, QuestionView } from './ActivityContent'
import { useConcepts, useModule } from './hooks'
import { formatDate, KIND_LABEL } from './labels'

/** `/review/:moduleId`: one published module, read only, in the order a student meets it. */
export function ModuleView() {
  const { moduleId = '' } = useParams()
  const module = useModule(moduleId)
  const concepts = useConcepts()
  const names = concepts.data // labels only; fine to be missing

  const back = (
    <Link to="/review" className="w-fit text-sm underline underline-offset-4">
      Back to all modules
    </Link>
  )

  if (module.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div role="status" aria-busy="true" aria-label="Loading module" className="flex flex-col gap-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (module.isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert variant="destructive" role="alert">
          <AlertTitle>This module did not load</AlertTitle>
          <AlertDescription>
            <p>{module.error.message}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void module.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const m = module.data
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        {back}
        <h2 className="text-2xl font-bold">{m.title}</h2>
        <p className="text-sm text-muted-foreground">
          Version {m.version} · published {formatDate(m.published_at)}
        </p>
        {m.summary ? <p>{m.summary}</p> : null}
      </header>

      <section aria-labelledby="lessons-heading" className="flex flex-col gap-6">
        <h3 id="lessons-heading" className="text-xl font-semibold">
          Lessons
        </h3>
        <ol className="flex list-none flex-col gap-8 pl-0">
          {m.lessons.map((lesson, li) => (
            <li key={lesson.id} className="flex flex-col gap-4">
              <h4 className="text-lg font-semibold">
                Lesson {li + 1}: {lesson.title}
              </h4>
              <ol className="flex list-none flex-col gap-6 pl-0">
                {lesson.activities.map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 border-l-2 pl-4">
                    <h5 className="font-medium">
                      {a.title}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({KIND_LABEL[a.kind]}
                        {a.required ? '' : ', optional'}
                        {a.concept_id ? ` · Concept: ${names?.get(a.concept_id) ?? a.concept_id}` : ''})
                      </span>
                    </h5>
                    <ActivityContent activity={a} concepts={names} />
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      {m.assessments.length > 0 && (
        <section aria-labelledby="tests-heading" className="flex flex-col gap-6">
          <h3 id="tests-heading" className="text-xl font-semibold">
            Pre-test and post-test
          </h3>
          {m.assessments.map((test) => (
            <div key={test.id} className="flex flex-col gap-4">
              <h4 className="text-lg font-semibold">
                {test.title} ({test.kind === 'pre' ? 'pre-test' : 'post-test'})
              </h4>
              <ol className="flex list-none flex-col gap-4 pl-0">
                {test.assessment_items.map((item) => (
                  <li key={item.id} className="rounded-lg border p-4">
                    <QuestionView question={item.content} concepts={names} />
                    <p className="mt-2 text-xs text-muted-foreground">Pairs with the matching question: {item.pair_key}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
    </article>
  )
}
