/**
 * Guest progress lives on this device only (ADR 0003). Versioned and validated with zod
 * on every read: anything unreadable resets to empty instead of crashing the page.
 * Answers are not stored; only which activities were finished and when.
 */
import { z } from 'zod'

import { log } from '@/lib/log'

export const GUEST_STORAGE_KEY = 'cic.guest.v1'

export const GuestProgressSchema = z.object({
  version: z.literal(1),
  completed: z.record(z.string(), z.object({ completed_at: z.iso.datetime() })),
})
export type GuestProgress = z.infer<typeof GuestProgressSchema>

export const emptyGuestProgress = (): GuestProgress => ({ version: 1, completed: {} })

export function readGuestProgress(storage: Storage = window.localStorage): GuestProgress {
  let raw: string | null
  try {
    raw = storage.getItem(GUEST_STORAGE_KEY)
  } catch (cause) {
    log.warn('student.guest.read_fail', { cause })
    return emptyGuestProgress()
  }
  if (raw === null) return emptyGuestProgress()
  try {
    const parsed = GuestProgressSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // fall through: invalid JSON is handled like an invalid shape
  }
  log.warn('student.guest.reset', { reason: 'corrupt_or_old_version' })
  storage.removeItem(GUEST_STORAGE_KEY)
  return emptyGuestProgress()
}

export function markGuestCompleted(
  activityId: string,
  now: Date = new Date(),
  storage: Storage = window.localStorage,
): GuestProgress {
  const current = readGuestProgress(storage)
  if (current.completed[activityId]) return current
  const next: GuestProgress = {
    ...current,
    completed: { ...current.completed, [activityId]: { completed_at: now.toISOString() } },
  }
  try {
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next))
  } catch (cause) {
    log.warn('student.guest.write_fail', { cause })
  }
  return next
}

export function clearGuestProgress(storage: Storage = window.localStorage): void {
  storage.removeItem(GUEST_STORAGE_KEY)
}
