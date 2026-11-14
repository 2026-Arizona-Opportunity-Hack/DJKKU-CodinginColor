import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

import { ErrorState, PageSkeleton } from '@/components/states'

import { describeError } from '../errors'

/** Loading / error / success for one query, so every page handles all three the same way (B13). */
export function QueryView<T>({
  query,
  children,
  label,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  label?: string
}) {
  if (query.isPending) return <PageSkeleton label={label} />
  if (query.isError) {
    const { message, reference } = describeError(query.error)
    return <ErrorState message={message} reference={reference} onRetry={() => void query.refetch()} />
  }
  return <>{children(query.data)}</>
}
