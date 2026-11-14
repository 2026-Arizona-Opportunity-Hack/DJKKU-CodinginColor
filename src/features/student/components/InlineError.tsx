import { Alert, AlertDescription } from '@/components/ui/alert'

import type { describeError } from '../errors'

/** A failed action's message and reference, shown next to the action (B13). */
export function InlineError({ error }: { error: ReturnType<typeof describeError> }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <p>{error.message}</p>
        {error.reference && <p className="text-xs">Reference: {error.reference}</p>}
      </AlertDescription>
    </Alert>
  )
}
