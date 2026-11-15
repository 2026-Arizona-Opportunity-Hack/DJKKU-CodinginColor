import { log } from '@/lib/log'

/**
 * Stale-code recovery. Each page's code is a separate file, downloaded on first visit. After a
 * new deploy those files are replaced (new names), and a tab opened before the deploy asks for
 * files that no longer exist; in development the same happens when the dev server restarts.
 * The browser reports it as a failed dynamic import. The cure is a reload, which fetches the
 * current version: we do that once automatically, and at most once every 30 seconds so a real
 * outage can never cause a reload loop.
 */

const KEY = 'cic.chunk-reload-at'
const WINDOW_MS = 30_000

// Chrome/Edge, Safari, Firefox and webpack-style wording for "could not load that code file".
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return CHUNK_ERROR.test(message)
}

type Deps = { now?: number; store?: Pick<Storage, 'getItem' | 'setItem'> | null; reload?: () => void }

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null // storage blocked: we cannot remember a reload, so we never auto-reload
  }
}

/** Reloads the page unless we already did in the last 30 s. Returns true if it reloaded. */
export function reloadOnce({ now = Date.now(), store = sessionStore(), reload = () => window.location.reload() }: Deps = {}): boolean {
  if (!store) return false
  const last = Number(store.getItem(KEY) ?? 0)
  if (now - last < WINDOW_MS) return false
  store.setItem(KEY, String(now))
  reload()
  return true
}

/**
 * Wraps a lazy `import()`: on a stale-code failure it reloads once and never settles (the page is
 * going away); any other failure, or a repeat within 30 s, is rethrown to the route's error screen.
 */
export function importWithReload<T>(load: () => Promise<T>, deps?: Deps): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      if (isChunkLoadError(error) && reloadOnce(deps)) {
        log.warn('app.chunk_reload', { cause: error })
        return new Promise<T>(() => {})
      }
      throw error
    })
}
