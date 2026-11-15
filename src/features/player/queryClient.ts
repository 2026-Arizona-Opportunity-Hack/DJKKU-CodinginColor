import { QueryCache, QueryClient } from '@tanstack/react-query'

import { isApiError, type ErrorCode } from '@/features/player/errors'

import { log } from '@/lib/log'

// Errors that a retry can't fix.
const NO_RETRY: ReadonlySet<ErrorCode> = new Set([
  'locked',
  'not_found',
  'unauthenticated',
  'invalid_response',
  'already_taken',
  'bad_response',
])

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Query failures are logged here, once. Mutations log in their own hooks (with their event names).
    queryCache: new QueryCache({
      onError: (error, query) => {
        // A query that marks its failure as expected (e.g. a video with no transcript) logs it itself.
        if (query.meta?.expectedFailure) return
        log.error('query.fail', {
          path: String(query.queryKey[0]),
          errorCode: isApiError(error) ? error.code : 'unknown',
          requestId: isApiError(error) ? error.requestId : undefined,
          cause: isApiError(error) ? error.cause : error,
        })
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 'always': we report offline ourselves instead of leaving a skeleton up forever.
        networkMode: 'always',
        retry: (count, error) => !(isApiError(error) && NO_RETRY.has(error.code)) && count < 2,
      },
      mutations: { networkMode: 'always', retry: false },
    },
  })
}
