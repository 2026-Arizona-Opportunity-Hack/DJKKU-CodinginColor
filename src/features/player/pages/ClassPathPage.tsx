import { Link, useParams } from 'react-router'

import { EmptyState } from '@/features/player/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { QueryView } from '@/features/player/components/QueryView'
import { StatusBadge } from '@/features/player/components/StatusBadge'
import { KIND_LABEL, moduleTally, overallTally, paths, type Tally } from '@/features/player/outline'
import { useOutline } from '@/features/player/queries'
import type { AssessmentRef, OutlineActivity, OutlineModule } from '@/features/player/types'

/** B6: modules → lessons → activities with server-provided status. Locked items aren't links. */
export function ClassPathPage() {
  const { classId = '' } = useParams()
  const outline = useOutline(classId)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Your path</h1>
        <Link to={paths.progress(classId)} className="inline-flex min-h-11 items-center text-primary underline">
          My progress
        </Link>
      </div>
      <QueryView query={outline} label="Loading your lessons">
        {(o) =>
          o.modules.length === 0 ? (
            <EmptyState title="No lessons yet">
              <p>Your instructor hasn't published any modules. Check back soon.</p>
            </EmptyState>
          ) : (
            <>
              <TallyBar label="Overall" tally={overallTally(o)} />
              {o.modules.map((m, i) => (
                <ModuleSection key={m.module_id} classId={classId} module={m} number={i + 1} />
              ))}
            </>
          )
        }
      </QueryView>
    </>
  )
}

function TallyBar({ label, tally }: { label: string; tally: Tally }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span>
          {tally.done} of {tally.total} done ({tally.pct}%)
        </span>
      </div>
      <Progress value={tally.pct} aria-label={`${label}: ${tally.pct}% done`} />
    </div>
  )
}

// Numbers come from list order, not `position`: the database counts from 0, the mock from 1.
function ModuleSection({ classId, module: m, number }: { classId: string; module: OutlineModule; number: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Module {number}: {m.title}
        </CardTitle>
        <TallyBar label="This module" tally={moduleTally(m)} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {m.pretest && <TestRow classId={classId} label="Pretest" test={m.pretest} />}
        {m.lessons.map((l, li) => (
          <section key={l.lesson_id} aria-labelledby={`lesson-${l.lesson_id}`}>
            <h3 id={`lesson-${l.lesson_id}`} className="mb-2 font-semibold">
              Lesson {li + 1}: {l.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {l.activities.map((a) => (
                <ActivityRow key={a.activity_id} classId={classId} activity={a} />
              ))}
            </ul>
          </section>
        ))}
        {m.posttest && <TestRow classId={classId} label="Post-test" test={m.posttest} />}
      </CardContent>
    </Card>
  )
}

// Lesson rows: solid white on the frosted card, Courier titles to match the headings.
const rowClass = 'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-white px-3 py-2'

function ActivityRow({ classId, activity: a }: { classId: string; activity: OutlineActivity }) {
  const title = (
    <span className="flex-1 font-display font-bold">
      <span className="sr-only">{KIND_LABEL[a.kind]}: </span>
      {a.title}
      <span aria-hidden="true" className="ml-2 font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {KIND_LABEL[a.kind]}
      </span>
    </span>
  )
  if (a.status === 'locked') {
    return (
      <li className={`${rowClass} bg-muted text-muted-foreground`}>
        {title}
        <StatusBadge status="locked" />
        {a.locked_reason && <span className="basis-full text-sm">{a.locked_reason}</span>}
      </li>
    )
  }
  return (
    <li>
      <Link to={paths.activity(classId, a.activity_id)} className={`${rowClass} transition-colors hover:border-tint-green-edge hover:bg-tint-green/60`}>
        {title}
        <StatusBadge status={a.status} />
      </Link>
    </li>
  )
}

function TestRow({ classId, label, test }: { classId: string; label: string; test: AssessmentRef }) {
  return (
    <div className={rowClass}>
      <span className="flex-1 font-display font-bold">{label}</span>
      <StatusBadge status={test.status} />
      {test.status === 'available' && (
        <Button asChild size="sm">
          <Link to={paths.test(classId, test.assessment_id)}>Take the {label.toLowerCase()}</Link>
        </Button>
      )}
    </div>
  )
}
