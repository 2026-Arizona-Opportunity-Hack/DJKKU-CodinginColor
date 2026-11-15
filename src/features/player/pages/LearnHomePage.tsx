import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

import { EmptyState } from '@/features/player/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QueryView } from '@/features/player/components/QueryView'
import { nextStep, paths } from '@/features/player/outline'
import { useMyClasses, useNextActivity, useOutline } from '@/features/player/queries'
import type { MyClass } from '@/features/player/types'

/** B5 "Start here": the student's class and one primary card pointing at `next_activity`. */
export function LearnHomePage() {
  const classes = useMyClasses()
  return (
    <>
      <h1 className="text-2xl font-bold">Start here</h1>
      <QueryView query={classes} label="Loading your classes">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="You're not in a class yet">
              <p>Ask your instructor for a join link or login code.</p>
            </EmptyState>
          ) : (
            list.map((c) => <ClassCard key={c.class_id} cls={c} />)
          )
        }
      </QueryView>
    </>
  )
}

function ClassCard({ cls }: { cls: MyClass }) {
  // Parallel, not a waterfall: both start as soon as the class id is known.
  const next = useNextActivity(cls.class_id)
  const outline = useOutline(cls.class_id)

  return (
    <Card>
      <CardHeader>
        <CardDescription>Your class</CardDescription>
        <CardTitle>{cls.class_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryView query={next} label="Finding your next step">
          {(n) => (
            <QueryView query={outline} label="Finding your next step">
              {(o) => {
                const step = nextStep(o, n)
                if (step.kind === 'done') {
                  return <p className="text-lg font-medium">You've finished everything in this class. Nice work.</p>
                }
                const { to, label, where } =
                  step.kind === 'pretest'
                    ? { to: paths.test(cls.class_id, step.assessment_id), label: `Start: ${step.module.title} pre-test`, where: step.module.title }
                    : step.kind === 'posttest'
                      ? { to: paths.test(cls.class_id, step.assessment_id), label: `Finish: ${step.module.title} post-test`, where: step.module.title }
                      : {
                          to: paths.activity(cls.class_id, step.activity.activity_id),
                          label: `Continue: ${step.activity.title}`,
                          where: `${step.module.title} · ${step.lesson.title}`,
                        }
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">{where}</p>
                    <Button asChild size="lg" className="w-full justify-between whitespace-normal sm:w-auto">
                      <Link to={to}>
                        {label} <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                )
              }}
            </QueryView>
          )}
        </QueryView>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline">
          <Link to={paths.path(cls.class_id)}>See all lessons</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to={paths.progress(cls.class_id)}>My progress</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
