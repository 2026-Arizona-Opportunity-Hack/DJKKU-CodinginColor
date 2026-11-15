import { describe, expect, it } from 'vitest'

// /api/docs is a static page (public/api/docs/). Its copy of the spec must match docs/openapi.yaml,
// and the script it loads must be pinned to an exact version with an integrity hash.
const files = import.meta.glob<string>(['../../docs/openapi.yaml', '../../public/api/docs/openapi.yaml', '../../public/api/docs/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const get = (suffix: string) => Object.entries(files).find(([k]) => k.endsWith(suffix))?.[1] ?? ''

describe('API docs page', () => {
  it('serves the same spec as docs/openapi.yaml', () => {
    const served = get('public/api/docs/openapi.yaml')
    expect(served.length).toBeGreaterThan(500)
    expect(served).toBe(get('docs/openapi.yaml'))
  })

  it('loads a pinned script with an integrity hash, not a floating tag', () => {
    const html = get('index.html')
    expect(html).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+\/dist\/browser\/standalone\.js/)
    expect(html).toMatch(/integrity="sha384-[A-Za-z0-9+/=]{64}"/)
    expect(html).not.toMatch(/api-reference@latest/)
  })

  it('shows a curl example with a bearer key', () => {
    expect(get('index.html')).toContain('Authorization: Bearer')
  })
})
