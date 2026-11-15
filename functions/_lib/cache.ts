import type { SourcesCache } from '../../shared/sources/handler'

// A best-effort cache for search results: first this isolate's memory, then Cloudflare's edge cache.
// Either may be empty at any time (a new isolate, another data centre, a *.pages.dev address where
// the edge cache may not store anything); a miss only costs one more upstream call. Results are the
// same for every author, so nothing personal is ever stored.

const DAY_S = 24 * 60 * 60
const MAX_ENTRIES = 300
const memory = new Map<string, { value: unknown; expires: number }>()

const edgeKey = async (key: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return new Request(`https://sources-cache.invalid/${hex}`)
}

export function sourcesCache(ttlS = DAY_S): SourcesCache {
  return {
    async get(key) {
      const hit = memory.get(key)
      if (hit && hit.expires > Date.now()) return hit.value
      memory.delete(key)
      try {
        const res = await caches.default.match(await edgeKey(key))
        if (!res) return undefined
        const value: unknown = await res.json()
        memory.set(key, { value, expires: Date.now() + ttlS * 1000 })
        return value
      } catch {
        return undefined
      }
    },
    async put(key, value) {
      if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value as string)
      memory.set(key, { value, expires: Date.now() + ttlS * 1000 })
      try {
        await caches.default.put(await edgeKey(key), Response.json(value, { headers: { 'Cache-Control': `public, max-age=${ttlS}` } }))
      } catch {
        // memory alone is fine
      }
    },
  }
}
