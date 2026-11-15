import { Alert, AlertDescription } from '@/components/ui/alert'

import { describeError } from '../errors'
import { useImportGuestProgressOnce } from '../queries'

/**
 * Copies guest progress from this device once the student is signed in (B4), and says how it went.
 * `enabled` is false for class students: import_guest_progress only accepts self-registered
 * (independent) students, so trying for anyone else always failed and showed a false warning.
 */
export function GuestImportNotice({ enabled }: { enabled: boolean }) {
  const merge = useImportGuestProgressOnce(enabled)
  if (merge.isSuccess && merge.data.imported > 0) {
    const n = merge.data.imported
    return (
      <Alert variant="success" aria-live="polite">
        <AlertDescription>
          <p>We copied {n} finished {n === 1 ? 'activity' : 'activities'} from this device to your account.</p>
        </AlertDescription>
      </Alert>
    )
  }
  if (merge.isError) {
    const { reference } = describeError(merge.error)
    return (
      <Alert variant="warning">
        <AlertDescription>
          <p>Your guest progress didn't copy over. It's still on this device; ask your instructor for help.</p>
          {reference && <p className="text-xs">Reference: {reference}</p>}
        </AlertDescription>
      </Alert>
    )
  }
  return null
}
