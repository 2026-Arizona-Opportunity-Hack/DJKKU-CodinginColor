import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { QueryView } from '@/features/student/components/QueryView'
import { locate, needsPretest, paths } from '@/features/student/outline'
import { useMyClasses, useNextActivity, useOutline } from '@/features/student/queries'
import type { MyClass } from '@/features/student/types'

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
                const found = n ? locate(o, n.activity_id) : null
                if (!n || !found) {
                  return <p className="text-lg font-medium">You've finished everything in this class. Nice work.</p>
                }
                const gate = needsPretest(found.module) && found.module.pretest
                const to = gate ? paths.test(cls.class_id, gate.assessment_id) : paths.activity(cls.class_id, n.activity_id)
                const label = gate ? `Start: ${found.module.title} pretest` : `Continue: ${found.activity.title}`
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {found.module.title} · {found.lesson.title}
                    </p>
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
