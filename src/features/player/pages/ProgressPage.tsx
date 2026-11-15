import { Link, useParams } from 'react-router'

import { EmptyState } from '@/features/player/components/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { QueryView } from '@/features/player/components/QueryView'
import { paths, whole } from '@/features/player/outline'
import { useMyProgress } from '@/features/player/queries'

// Display only: the database sends long decimals, so round here and keep the raw values in state.
const pct = (n: number | null | undefined) => (n === null || n === undefined ? 'Not taken' : `${whole(n)}%`)
const signed = (n: number | null | undefined) => {
  if (n === null || n === undefined) return 'Not yet' // never shown as 0: no post-test yet is not "no growth"
  const w = whole(n)
  return `${w > 0 ? '+' : ''}${w} points`
}

/** B10: the student's own progress: completed activities, module progress, pre/post and gain. */
export function ProgressPage() {
  const { classId = '' } = useParams()
  const progress = useMyProgress(classId)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">My progress</h1>
        <Link to={paths.path(classId)} className="inline-flex min-h-11 items-center text-primary underline">
          Back to your path
        </Link>
      </div>
      <QueryView query={progress} label="Loading your progress">
        {(p) =>
          p.total === 0 ? (
            <EmptyState title="Nothing to track yet" />
          ) : (
            <>
              <p className="text-lg">
                You've completed <strong>{p.completed}</strong> of <strong>{p.total}</strong> activities.
              </p>
              {p.modules.map((m, i) => (
                <Card key={m.title}>
                  <CardHeader>
                    <CardTitle>{m.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{whole(m.pct)}% of activities done</span>
                      <Progress value={whole(m.pct)} aria-label={`${m.title}: ${whole(m.pct)}% done`} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Pretest', pct(m.pre_pct)],
                        ['Post-test', pct(m.post_pct)],
                        ['Growth', signed(m.gain)],
                      ].map(([term, value]) => (
                        <div key={term} className="rounded-md bg-muted p-2">
                          <dt className="text-xs text-muted-foreground">{term}</dt>
                          <dd className="font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {m.post_pct !== null && m.post_pct !== undefined && (
                      <Link to={paths.certificate(classId, i)} className="inline-flex min-h-11 items-center self-start font-medium text-primary underline">
                        View my certificate for {m.title}
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )
        }
      </QueryView>
    </>
  )
}
