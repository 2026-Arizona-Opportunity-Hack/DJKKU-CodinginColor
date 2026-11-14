/**
 * Guest progress lives on this device only (ADR 0003). Versioned and validated with zod
 * on every read: anything unreadable resets to empty instead of crashing the page.
 * Answers are not stored; only which activities were finished and when.
 * All storage access goes through safeStorage, so blocked storage never throws.
 */
import { z } from 'zod'

import { log } from '@/lib/log'

import { getStore, safeGet, safeParse, safeRemove, safeSet } from './safeStorage'

export const GUEST_STORAGE_KEY = 'cic.guest.v1'

export const GuestProgressSchema = z.object({
  version: z.literal(1),
  completed: z.record(z.string(), z.object({ completed_at: z.string().datetime() })),
})
export type GuestProgress = z.infer<typeof GuestProgressSchema>

export const emptyGuestProgress = (): GuestProgress => ({ version: 1, completed: {} })

export function readGuestProgress(store: Storage | null = getStore()): GuestProgress {
  const raw = safeGet(GUEST_STORAGE_KEY, store)
  if (raw === null) return emptyGuestProgress()
  const parsed = GuestProgressSchema.safeParse(safeParse(raw))
  if (parsed.success) return parsed.data
  log.warn('student.guest.reset', { reason: 'corrupt_or_old_version' })
  safeRemove(GUEST_STORAGE_KEY, store)
  return emptyGuestProgress()
}

export function markGuestCompleted(activityId: string, now: Date = new Date(), store: Storage | null = getStore()): GuestProgress {
  const current = readGuestProgress(store)
  if (current.completed[activityId]) return current
  const next: GuestProgress = {
    ...current,
    completed: { ...current.completed, [activityId]: { completed_at: now.toISOString() } },
  }
  safeSet(GUEST_STORAGE_KEY, JSON.stringify(next), store)
  return next
}

export function clearGuestProgress(store: Storage | null = getStore()): void {
  safeRemove(GUEST_STORAGE_KEY, store)
}
