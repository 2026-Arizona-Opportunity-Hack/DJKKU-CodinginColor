import { useEffect } from 'react'

import { log } from '@/lib/log'

import { HEARTBEAT_SECONDS } from './api'
import { useStudentApi } from './apiContext'

/** Time-on-task: one heartbeat every 30 s while the tab is visible (contract: capped at 30). */
export function useHeartbeat(activityId: string, enabled: boolean): void {
  const api = useStudentApi()
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      api.heartbeat(activityId, HEARTBEAT_SECONDS).catch((cause: unknown) => {
        // Losing a heartbeat costs 30 s of time-on-task data, nothing more: debug only.
        log.debug('student.heartbeat.fail', { activityId, cause })
      })
    }, HEARTBEAT_SECONDS * 1000)
    return () => window.clearInterval(timer)
  }, [api, activityId, enabled])
}
