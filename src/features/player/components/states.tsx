/**
 * Shared page states (B13): loading skeleton, empty, error (message + ref + Retry).
 * Generic on purpose: features translate their errors into a message and a reference.
 */
import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RotateCcw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4" data-testid="page-skeleton">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function ErrorState({
  title = "This didn't load",
  message,
  reference,
  onRetry,
  children,
}: {
  title?: string
  message: string
  reference?: string
  onRetry?: () => void
  children?: ReactNode
}) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {reference && <p className="text-xs text-muted-foreground">Reference: {reference}</p>}
        {(onRetry || children) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw aria-hidden="true" /> Try again
              </Button>
            )}
            {children}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  )
}
