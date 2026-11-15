import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { isChunkLoadError } from '@/lib/chunkReload'
import { log } from '@/lib/log'

import { ErrorState } from './components/states'
import { paths } from './outline'

/** Route error boundary for /learn/*: logs once, offers a way out. Renders inside the app's <main>. */
export function PlayerError() {
  const error = useRouteError()
  // The page's code could not be downloaded: a new version was deployed (or the dev server
  // stopped) while this tab was open. Not a bug in the page, so say what fixes it.
  const stale = isChunkLoadError(error)
  useEffect(() => log.error('app.route_error', { path: '/learn', stale_code: stale, cause: error }), [error, stale])
  return (
    <ErrorState
      title={stale ? 'This page needs a fresh copy' : 'Something broke on this page'}
      message={
        stale
          ? 'The app was updated or lost its connection while this tab was open. Reload to get the latest version.'
          : 'Reload the page. If it keeps happening, tell your instructor.'
      }
      onRetry={() => window.location.reload()}
    >
      <Button asChild variant="secondary">
        <Link to={paths.home}>Go to Start here</Link>
      </Button>
    </ErrorState>
  )
}
