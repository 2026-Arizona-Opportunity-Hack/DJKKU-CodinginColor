import { useCallback, useState } from 'react'

import { markGuestCompleted, readGuestProgress, type GuestProgress } from './guestProgress'

/** Guest progress for this device, read once per mount and updated in place. */
export function useGuestProgress(): [GuestProgress, (activityId: string) => void] {
  const [progress, setProgress] = useState(readGuestProgress)
  const markDone = useCallback((activityId: string) => setProgress(markGuestCompleted(activityId)), [])
  return [progress, markDone]
}
