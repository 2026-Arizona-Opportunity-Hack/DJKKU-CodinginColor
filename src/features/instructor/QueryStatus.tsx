import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type QueryLike<T> = { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }

/** Loading, error (with Try again) and empty states for a query; `children` renders the data. */
export function QueryStatus<T>({
  query,
  label,
  empty,
  isEmpty,
  children,
}: {
  query: QueryLike<T>
  label: string
  /** Shown when `isEmpty(data)` is true. */
  empty: ReactNode
  isEmpty: (data: T) => boolean
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <p role="status">Loading {label}…</p>
  if (query.isError || query.data === undefined) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-red-700">
        <p>We could not load {label}.{query.error instanceof Error ? ` ${query.error.message}` : ''}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  if (isEmpty(query.data)) return <div className="text-sm text-muted-foreground">{empty}</div>
  return <>{children(query.data)}</>
}
