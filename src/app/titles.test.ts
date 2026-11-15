import { describe, expect, it } from 'vitest'
import { features } from './features'
import { pageTitle } from './titles'

describe('pageTitle', () => {
  it.each([
    ['/', 'Home'],
    ['/sign-in', 'Sign in'],
    ['/join/ABCD-EFGH-IJKL', 'Join your class'],
    ['/learn', 'Start here'],
    ['/learn/c1', 'Your path'],
    ['/learn/c1/a/x', 'Activity'],
    ['/learn/c1/test/t1', 'Test'],
    ['/learn/c1/progress', 'My progress'],
    ['/learn/explore', 'Free lessons'],
    ['/author/new', 'New module'],
    ['/admin/keys', 'Admin: API keys'],
    ['/review/m1', 'Module review'],
    ['/nowhere', 'Page not found'],
  ])('%s is "%s | Coding in Color Learn"', (path, label) => expect(pageTitle(path)).toBe(`${label} | Coding in Color Learn`))

  it('gives every feature path its own title, never the not-found one', () => {
    for (const f of features) expect(pageTitle(f.path)).not.toMatch(/^Page not found/)
  })
})
