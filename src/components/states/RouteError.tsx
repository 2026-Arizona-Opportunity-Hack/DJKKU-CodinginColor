import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { log } from '@/lib/log'

import { ErrorState } from './index'

/** Error boundary for every route: logs once, offers a way out. */
export function RouteError({ notFound: forcedNotFound = false }: { notFound?: boolean }) {
  const error = useRouteError()
  const notFound = forcedNotFound || (isRouteErrorResponse(error) && error.status === 404)

  useEffect(() => {
    if (!notFound) log.error('app.route_error', { cause: error })
  }, [error, notFound])

  return (
    <main id="main" className="mx-auto max-w-2xl p-4">
      <ErrorState
        title={notFound ? 'Page not found' : 'Something broke on this page'}
        message={notFound ? "That link doesn't go anywhere." : 'Reload the page. If it keeps happening, tell your instructor.'}
        onRetry={notFound ? undefined : () => window.location.reload()}
      >
        <Button asChild variant="secondary">
          <Link to="/">Go to the start page</Link>
        </Button>
      </ErrorState>
    </main>
  )
}
