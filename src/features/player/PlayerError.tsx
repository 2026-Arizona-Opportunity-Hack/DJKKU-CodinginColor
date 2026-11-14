import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { log } from '@/lib/log'

import { ErrorState } from './components/states'

/** Route error boundary for /learn/*: logs once, offers a way out. Renders inside the app's <main>. */
export function PlayerError() {
  const error = useRouteError()
  useEffect(() => log.error('app.route_error', { path: '/learn', cause: error }), [error])
  return (
    <ErrorState
      title="Something broke on this page"
      message="Reload the page. If it keeps happening, tell your instructor."
      onRetry={() => window.location.reload()}
    >
      <Button asChild variant="secondary">
        <Link to="/learn">Go to Start here</Link>
      </Button>
    </ErrorState>
  )
}
