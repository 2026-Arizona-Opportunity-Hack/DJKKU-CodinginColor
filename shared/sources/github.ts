import { OPEN_LICENSES, SourceError, type License, type ReadmeResponse, type SourceResult } from './catalog'

// GitHub REST API. Search works without a token (10 searches a minute per server IP); a token with
// no scopes raises that to 30. Only repositories under an open license are offered, and the README
// endpoint checks the license again itself, so the browser cannot import anything else.

const API = 'https://api.github.com'
const TIMEOUT_MS = 6000
/** The reading body limit in shared/authoring/schemas.ts. */
export const MAX_READING_CHARS = 20000

type Repo = {
  full_name?: string
  name?: string
  html_url?: string
  description?: string | null
  stargazers_count?: number
  default_branch?: string
  pushed_at?: string
  owner?: { login?: string; avatar_url?: string }
  license?: { spdx_id?: string | null } | null
}

const headers = (token: string | undefined, accept = 'application/vnd.github+json'): Record<string, string> => ({
  Accept: accept,
  'User-Agent': 'cic-curriculum-platform', // GitHub refuses requests without one
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

async function get(f: typeof fetch, path: string, token: string | undefined, accept?: string): Promise<Response> {
  let res: Response
  try {
    res = await f(`${API}${path}`, { headers: headers(token, accept), signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new SourceError('unavailable')
  }
  if (res.ok) return res
  if (res.status === 404) throw new SourceError('not_found')
  // Out of searches for this minute: 403 with x-ratelimit-remaining 0, or 429.
  if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) throw new SourceError('quota')
  throw new SourceError('unavailable')
}

export function licenseOf(spdx: string | null | undefined): License {
  const id = spdx ?? 'none'
  const name = OPEN_LICENSES[id]
  return name ? { id, name, open: true } : { id, name: id === 'none' ? 'No license' : id === 'NOASSERTION' ? 'Other license' : id, open: false }
}

/** Fewer open-licensed repositories than this from the beginner search, and a plain search tops it up. */
const ENOUGH = 4

/**
 * GitHub's best match, not most stars: sorting by stars ranks famous projects that merely mention a
 * word ("for loops" found AI agent frameworks). Learning material first: the topic plus "beginners"
 * (checked by hand on 2026-11-14: "loops" → Python basics and exercises). Narrow topics find little
 * that way ("flexbox" found one), so a plain search fills the rest.
 */
export async function searchGitHub(f: typeof fetch, token: string | undefined, q: { query: string; language: string | null; max?: number }): Promise<SourceResult[]> {
  const max = q.max ?? 8
  const run = async (words: string) => {
    const terms = [words, q.language ? `language:${q.language}` : '', 'archived:false', 'fork:false', 'is:public'].filter(Boolean).join(' ')
    const data = (await (await get(f, `/search/repositories?${new URLSearchParams({ q: terms, per_page: '30' })}`, token)).json()) as { items?: Repo[] }
    return (data.items ?? []).filter((r) => r.full_name && r.html_url && licenseOf(r.license?.spdx_id).open)
  }
  let repos = /\bbeginner/i.test(q.query) ? await run(q.query) : await run(`${q.query} beginners`)
  if (repos.length < ENOUGH && !/\bbeginner/i.test(q.query)) {
    const seen = new Set(repos.map((r) => r.full_name))
    repos = [...repos, ...(await run(q.query)).filter((r) => !seen.has(r.full_name))]
  }
  return repos
    .slice(0, max)
    .map((r) => ({
      source: 'github',
      kind: 'reading',
      id: r.full_name!,
      title: r.full_name!,
      url: r.html_url!,
      by: r.owner?.login ?? '',
      description: r.description ?? '',
      license: licenseOf(r.license?.spdx_id),
      durationS: null,
      stars: r.stargazers_count ?? 0,
      thumbnail: null,
      publishedAt: r.pushed_at ?? null,
    }))
}

const HTML_TAG = /<\/?(?:a|b|i|u|p|br|hr|img|div|span|h[1-6]|center|picture|source|video|iframe|details|summary|strong|em|sub|sup|small|kbd|code|pre|table|thead|tbody|tr|td|th|ul|ol|li|dl|dt|dd|blockquote|figure|figcaption|svg|path|g)\b[^>]*>/gi

/**
 * A README made into a lesson reading: images, badges and HTML removed (students would load them
 * from other sites), relative links made absolute, the source and license on the first line, and
 * cut at a paragraph to fit the 20,000 character limit with a link to the rest.
 */
export function toReading(markdown: string, repo: { fullName: string; url: string; branch: string; license: License }): string {
  const blob = `${repo.url}/blob/${repo.branch}/`
  // Code is copied exactly (`#include <stdio.h>`, `<div>`): set it aside, clean the rest, put it back.
  const kept: string[] = []
  const text = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?(?:```|$)|`[^`\n]+`/g, (code) => `${kept.push(code) - 1}`)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // badges: an image inside a link
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '') // reference-style images
    .replace(HTML_TAG, '') // the reader skips HTML anyway; this keeps the editor clean. `<your-name>` stays.
    .replace(/\[([^\]]*)\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (_, label: string, path: string) => `[${label}](${blob}${path.replace(/^\.?\//, '')})`)
    .replace(/\[\s*\]\([^)]*\)/g, '') // links left with no text
    .replace(/(\d+)/g, (_, i: string) => kept[Number(i)] ?? '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const header = `> From [${repo.fullName}](${repo.url}) on GitHub, under the ${repo.license.name}.\n\n`
  const more = `\n\n[Read the rest on GitHub](${repo.url})`
  if (header.length + text.length <= MAX_READING_CHARS) return header + text
  const room = MAX_READING_CHARS - header.length - more.length
  const cut = text.lastIndexOf('\n\n', room)
  return header + text.slice(0, cut > room / 2 ? cut : room).trimEnd() + more
}

export async function fetchReadme(f: typeof fetch, token: string | undefined, fullName: string): Promise<ReadmeResponse> {
  const repo = (await (await get(f, `/repos/${fullName}`, token)).json()) as Repo
  const license = licenseOf(repo.license?.spdx_id)
  if (!license.open) throw new SourceError('not_open_license')
  let markdown: string
  try {
    markdown = await (await get(f, `/repos/${fullName}/readme`, token, 'application/vnd.github.raw+json')).text()
  } catch (e) {
    throw e instanceof SourceError && e.code === 'not_found' ? new SourceError('no_readme') : e
  }
  const name = repo.full_name ?? fullName
  const url = repo.html_url ?? `https://github.com/${name}`
  return {
    title: `${repo.name ?? name} (GitHub)`.slice(0, 120),
    body: toReading(markdown, { fullName: name, url, branch: repo.default_branch ?? 'HEAD', license }),
    url,
    license,
  }
}
