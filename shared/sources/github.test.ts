import { describe, expect, it } from 'vitest'
import { fetchReadme, licenseOf, MAX_READING_CHARS, searchGitHub, toReading } from './github'

const repo = (full: string, spdx: string | null, stars = 10) => ({
  full_name: full, name: full.split('/')[1], html_url: `https://github.com/${full}`, description: 'Practice loops', stargazers_count: stars,
  default_branch: 'main', pushed_at: '2026-01-01T00:00:00Z', owner: { login: full.split('/')[0] }, license: spdx ? { spdx_id: spdx } : null,
})

function fakeFetch(route: (url: URL, init?: RequestInit) => Response) {
  const calls: { url: URL; init?: RequestInit }[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    return route(url, init)
  }) as typeof fetch
  return { f, calls }
}

describe('searchGitHub', () => {
  it('looks for beginner material first: public, active, non-fork repositories in the language, best match', async () => {
    const many = Array.from({ length: 5 }, (_, i) => repo(`kid/loops-${i}`, 'MIT'))
    const { f, calls } = fakeFetch(() => Response.json({ items: many }))
    const results = await searchGitHub(f, undefined, { query: 'for loops', language: 'python' })
    expect(calls).toHaveLength(1) // enough found, no second search
    const p = calls[0]!.url.searchParams
    expect(calls[0]!.url.pathname).toBe('/search/repositories')
    expect(p.get('q')).toBe('for loops beginners language:python archived:false fork:false is:public')
    expect(p.get('sort')).toBeNull() // GitHub's best match: sorting by stars ranks famous, unrelated projects
    expect(results).toHaveLength(5)
    const h = calls[0]!.init!.headers as Record<string, string>
    expect(h['User-Agent']).toBeTruthy()
    expect(h.Authorization).toBeUndefined()
  })

  it('tops up a narrow topic with a plain search, without repeating a repository', async () => {
    const { f, calls } = fakeFetch((url) => Response.json({
      items: url.searchParams.get('q')!.includes('beginners') ? [repo('a/intro', 'MIT')] : [repo('a/intro', 'MIT'), repo('b/froggy', 'MIT')],
    }))
    const results = await searchGitHub(f, 'gh-token', { query: 'flexbox', language: null })
    expect(calls.map((c) => c.url.searchParams.get('q'))).toEqual([
      'flexbox beginners archived:false fork:false is:public',
      'flexbox archived:false fork:false is:public',
    ])
    expect(results.map((r) => r.id)).toEqual(['a/intro', 'b/froggy'])
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer gh-token')
  })

  it('does not add "beginners" twice', async () => {
    const { f, calls } = fakeFetch(() => Response.json({ items: [] }))
    await searchGitHub(f, undefined, { query: 'python for beginners', language: null })
    expect(calls.map((c) => c.url.searchParams.get('q'))).toEqual(['python for beginners archived:false fork:false is:public'])
  })

  it('offers only openly licensed repositories', async () => {
    const { f } = fakeFetch(() => Response.json({ items: [repo('a/none', null), repo('b/mit', 'MIT', 50), repo('c/other', 'NOASSERTION'), repo('d/gpl', 'GPL-3.0'), repo('e/cc', 'CC-BY-4.0')] }))
    const results = await searchGitHub(f, undefined, { query: 'loops', language: null })
    expect(results.map((r) => [r.id, r.license.name])).toEqual([['b/mit', 'MIT License'], ['e/cc', 'CC BY 4.0']])
    expect(results[0]).toMatchObject({ source: 'github', kind: 'reading', url: 'https://github.com/b/mit', by: 'b', stars: 50, durationS: null })
  })

  it('says "quota" when out of searches for the minute', async () => {
    const { f } = fakeFetch(() => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }))
    await expect(searchGitHub(f, undefined, { query: 'x', language: null })).rejects.toMatchObject({ code: 'quota' })
  })
})

describe('licenseOf', () => {
  it('names open, other and missing licenses', () => {
    expect(licenseOf('Apache-2.0')).toEqual({ id: 'Apache-2.0', name: 'Apache License 2.0', open: true })
    expect(licenseOf('NOASSERTION')).toEqual({ id: 'NOASSERTION', name: 'Other license', open: false })
    expect(licenseOf(null)).toEqual({ id: 'none', name: 'No license', open: false })
  })
})

const META = { fullName: 'cic/loops', url: 'https://github.com/cic/loops', branch: 'main', license: licenseOf('MIT') }

describe('toReading', () => {
  it('puts the source and license first, and removes badges, images and HTML', () => {
    const md = [
      '[![Build](https://img.shields.io/x.svg)](https://ci.example)',
      '<p align="center"><img src="logo.png"></p>',
      '# Loops',
      '![diagram](docs/loop.png)',
      'A loop repeats code. <!-- hidden note -->',
    ].join('\r\n')
    expect(toReading(md, META)).toBe('> From [cic/loops](https://github.com/cic/loops) on GitHub, under the MIT License.\n\n# Loops\n\nA loop repeats code.')
  })

  it('makes relative links absolute and leaves code exactly as written', () => {
    const md = 'See [the exercises](./exercises/one.md) and [docs](https://x.dev) or [top](#loops).\n\n```c\n#include <stdio.h>\n![not an image](x)\n```\n\nUse `List<String>` here.'
    const body = toReading(md, META)
    expect(body).toContain('[the exercises](https://github.com/cic/loops/blob/main/exercises/one.md)')
    expect(body).toContain('[docs](https://x.dev)')
    expect(body).toContain('[top](#loops)')
    expect(body).toContain('```c\n#include <stdio.h>\n![not an image](x)\n```')
    expect(body).toContain('`List<String>`')
  })

  it('keeps placeholders that only look like HTML, and fixes links whose text is code', () => {
    const body = toReading('Clone https://github.com/<your-username>/repo and open [`/curriculum`](/curriculum). Use the `<div>` tag.', META)
    expect(body).toContain('https://github.com/<your-username>/repo')
    expect(body).toContain('[`/curriculum`](https://github.com/cic/loops/blob/main/curriculum)')
    expect(body).toContain('`<div>`')
  })

  it('cuts a long README at a paragraph to fit the reading limit, with a link to the rest', () => {
    const para = 'word '.repeat(199).trim()
    const body = toReading(Array.from({ length: 40 }, () => para).join('\n\n'), META)
    expect(body.length).toBeLessThanOrEqual(MAX_READING_CHARS)
    expect(body.endsWith('word\n\n[Read the rest on GitHub](https://github.com/cic/loops)')).toBe(true)
  })
})

describe('fetchReadme', () => {
  const route = (license: string | null, readme: Response = new Response('# Hi\n\nHello')) => (url: URL) =>
    url.pathname.endsWith('/readme') ? readme : Response.json(repo('cic/loops', license))

  it('checks the license itself, then returns a reading with a title', async () => {
    const { f, calls } = fakeFetch(route('MIT'))
    const r = await fetchReadme(f, undefined, 'cic/loops')
    expect(r).toEqual({ title: 'loops (GitHub)', body: '> From [cic/loops](https://github.com/cic/loops) on GitHub, under the MIT License.\n\n# Hi\n\nHello', url: 'https://github.com/cic/loops', license: licenseOf('MIT') })
    expect((calls[1]!.init!.headers as Record<string, string>).Accept).toBe('application/vnd.github.raw+json')
  })

  it('refuses a repository without an open license, without reading the README', async () => {
    const { f, calls } = fakeFetch(route(null))
    await expect(fetchReadme(f, undefined, 'cic/loops')).rejects.toMatchObject({ code: 'not_open_license' })
    expect(calls).toHaveLength(1)
  })

  it('says when there is no README', async () => {
    const { f } = fakeFetch(route('MIT', new Response('{}', { status: 404 })))
    await expect(fetchReadme(f, undefined, 'cic/loops')).rejects.toMatchObject({ code: 'no_readme' })
  })
})
