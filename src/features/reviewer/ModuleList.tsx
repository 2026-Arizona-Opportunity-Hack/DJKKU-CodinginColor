import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useModules } from './hooks'
import { formatDate } from './labels'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** `/review`: every published module, newest content first by title. */
export function ModuleList() {
  const modules = useModules()

  if (modules.isPending) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading modules" className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (modules.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>The modules did not load</AlertTitle>
        <AlertDescription>
          <p>{modules.error.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void modules.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (modules.data.length === 0) {
    return (
      <p role="status">
        There are no published modules to review yet. Modules appear here once a CIC admin publishes them.
      </p>
    )
  }

  return (
    <section aria-labelledby="published-modules" className="flex flex-col gap-4">
      <h2 id="published-modules" className="text-xl font-semibold">
        Published modules
      </h2>
      <ul className="flex list-none flex-col gap-4 pl-0">
        {modules.data.map((m) => (
          <li key={m.id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link to={`/review/${m.id}`} className="underline underline-offset-4">
                    {m.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Version {m.version} · published {formatDate(m.publishedAt)} · {count(m.lessonCount, 'lesson', 'lessons')},{' '}
                  {count(m.activityCount, 'activity', 'activities')}
                </CardDescription>
              </CardHeader>
              {m.summary ? <p className="px-5 text-sm">{m.summary}</p> : null}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
