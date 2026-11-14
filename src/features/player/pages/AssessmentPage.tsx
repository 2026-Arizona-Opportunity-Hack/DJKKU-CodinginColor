import { Link, useParams } from 'react-router'
import { CheckCircle2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { QueryView } from '@/features/player/components/QueryView'
import { QuestionForm } from '@/features/player/components/QuestionForm'
import { InlineError } from '@/features/player/components/InlineError'
import { describeError } from '@/features/player/errors'
import { paths } from '@/features/player/outline'
import { useAssessment, useSubmitAssessment } from '@/features/player/queries'
import type { Assessment } from '@/features/player/types'

/** B7: pre/post test. Submits once; shows the score, never the answers. */
export function AssessmentPage() {
  const { classId = '', assessmentId = '' } = useParams()
  const assessment = useAssessment(assessmentId)

  return (
    <QueryView query={assessment} label="Loading the test">
      {(a) => <AssessmentBody key={a.assessment_id} classId={classId} assessment={a} />}
    </QueryView>
  )
}

function AssessmentBody({ classId, assessment: a }: { classId: string; assessment: Assessment }) {
  const submit = useSubmitAssessment(a.assessment_id)
  const failure = submit.isError ? describeError(submit.error) : null
  // Submit once: after a success (or a server "already taken") the form stays locked.
  const sent = submit.isSuccess || failure?.code === 'already_taken' || a.taken
  const title = a.kind === 'pre' ? 'Pretest' : 'Post-test'

  return (
    <article className="flex flex-col gap-4" aria-labelledby="test-title">
      <header className="flex flex-col gap-1">
        <h1 id="test-title" className="text-2xl font-bold">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {a.kind === 'pre'
            ? "This shows what you already know. It's fine not to know the answers yet: this test isn't graded for points."
            : 'Show what you learned in this module. You can take it once.'}
        </p>
      </header>

      {a.taken && !submit.isSuccess ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>You've already taken this test</AlertTitle>
          <AlertDescription>
            <Button asChild>
              <Link to={paths.path(classId)}>Back to your path</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <QuestionForm
          questions={a.items}
          submitLabel={`Send my ${title.toLowerCase()}`}
          pending={submit.isPending}
          locked={sent}
          onSubmit={(responses) => {
            if (!sent) submit.mutate(responses)
          }}
        />
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {submit.data && (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Sent. Your score: {submit.data.score_pct}%</AlertTitle>
            <AlertDescription>
              {submit.data.per_concept.length > 0 && (
                <ul className="list-disc pl-5">
                  {submit.data.per_concept.map((c) => (
                    <li key={c.concept}>
                      {c.concept}: {c.pct}%
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild>
                <Link to={paths.path(classId)}>{a.kind === 'pre' ? 'Start the module' : 'Back to your path'}</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {failure && (
          <InlineError error={failure} />
        )}
      </div>
    </article>
  )
}
