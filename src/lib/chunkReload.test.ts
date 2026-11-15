import { describe, expect, it, vi } from 'vitest'

import { importWithReload, isChunkLoadError, reloadOnce } from './chunkReload'

/** In-memory stand-in for sessionStorage. */
const memoryStore = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: http://localhost:5173/src/features/player/PlayerApp.tsx', // Chrome, Edge
    'Importing a module script failed.', // Safari
    'error loading dynamically imported module: https://x.pages.dev/assets/PlayerApp-abc.js', // Firefox
  ])('recognises the browser message %#', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('useStudentApi must be used inside <StudentApiProvider>'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('reloadOnce', () => {
  it('reloads once, then not again within 30 seconds, then again after', () => {
    const store = memoryStore()
    const reload = vi.fn()
    expect(reloadOnce({ now: 1_000_000, store, reload })).toBe(true)
    expect(reloadOnce({ now: 1_029_999, store, reload })).toBe(false) // no loop during an outage
    expect(reloadOnce({ now: 1_030_000, store, reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('never auto-reloads when storage is blocked (it could not remember, so it could loop)', () => {
    const reload = vi.fn()
    expect(reloadOnce({ store: null, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('importWithReload', () => {
  const stale = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/PlayerApp-old.js'))

  it('reloads on stale code and never settles, so no error screen flashes', async () => {
    const reload = vi.fn()
    const pending = importWithReload(stale, { store: memoryStore(), reload })()
    const settled = await Promise.race([pending.then(() => 'settled', () => 'settled'), new Promise((r) => setTimeout(() => r('pending'), 20))])
    expect(settled).toBe('pending')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows the error screen instead when it already reloaded just now', async () => {
    const store = memoryStore()
    store.setItem('cic.chunk-reload-at', String(Date.now()))
    const reload = vi.fn()
    await expect(importWithReload(stale, { store, reload })()).rejects.toThrow(/dynamically imported module/)
    expect(reload).not.toHaveBeenCalled()
  })

  it('passes ordinary failures through untouched', async () => {
    const reload = vi.fn()
    await expect(importWithReload(() => Promise.reject(new Error('boom')), { store: memoryStore(), reload })()).rejects.toThrow('boom')
    expect(reload).not.toHaveBeenCalled()
  })

  it('returns the module when loading works', async () => {
    await expect(importWithReload(() => Promise.resolve({ ok: 1 }))()).resolves.toEqual({ ok: 1 })
  })
})
