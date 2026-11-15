import { describe, expect, it } from 'vitest'
import { features } from './features'

// Guards the "add a feature by adding a folder" contract: a clash or a stray
// route fails here instead of breaking the app for everyone.
describe('feature registry', () => {
  it('has unique ids', () => {
    const ids = features.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique top-level paths, and none takes over the home page', () => {
    const paths = features.flatMap((f) => [f.path, ...(f.extraPaths ?? [])])
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).not.toContain('/')
  })

  it('keeps every route inside its own feature path', () => {
    for (const feature of features) {
      expect(feature.path.startsWith('/')).toBe(true)
      expect(feature.routes.length).toBeGreaterThan(0)
      for (const route of feature.routes) {
        const owned = [feature.path, ...(feature.extraPaths ?? [])]
        expect(owned.some((p) => route.path?.startsWith(p))).toBe(true)
      }
    }
  })
})
