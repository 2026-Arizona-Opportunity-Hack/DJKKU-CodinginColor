/**
 * Every Web Storage access in the player goes through here. Storage can be missing or
 * throw (private mode, blocked third-party storage, quota). A failure returns null or
 * does nothing, and is logged once at warn per operation and key, so a page never crashes
 * because of storage.
 */
import { log } from '@/lib/log'

export type StoreKind = 'local' | 'session'

const warned = new Set<string>()
function warnOnce(op: string, key: string, cause: unknown): void {
  const id = `${op}:${key}`
  if (warned.has(id)) return
  warned.add(id)
  log.warn('storage.unavailable', { op, key, cause })
}

export function getStore(kind: StoreKind = 'local'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch (cause) {
    warnOnce('open', kind, cause)
    return null
  }
}

export function safeGet(key: string, store: Storage | null = getStore()): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch (cause) {
    warnOnce('get', key, cause)
    return null
  }
}

export function safeSet(key: string, value: string, store: Storage | null = getStore()): void {
  try {
    store?.setItem(key, value)
  } catch (cause) {
    warnOnce('set', key, cause)
  }
}

export function safeRemove(key: string, store: Storage | null = getStore()): void {
  try {
    store?.removeItem(key)
  } catch (cause) {
    warnOnce('remove', key, cause)
  }
}

/** JSON.parse that returns null instead of throwing. */
export function safeParse(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
