import { z } from 'zod'

// "Find material": what an author can search, and the shapes the browser and the server agree on.
// Videos are only ever embedded (youtube-nocookie), never copied. Text is only imported from GitHub
// repositories under an open license, with the source and license written at the top.

/** Where material can come from. The two channel presets are YouTube searches limited to one channel. */
export const SOURCES = {
  youtube: { label: 'YouTube', kind: 'video', channelId: null },
  freecodecamp: { label: 'freeCodeCamp (YouTube)', kind: 'video', channelId: 'UC8butISFwT-Wl7EV0hUK0BQ' },
  cs50: { label: 'Harvard CS50 (YouTube)', kind: 'video', channelId: 'UCcabW7890RKJzL968QWEykA' },
  github: { label: 'GitHub (READMEs as readings)', kind: 'reading', channelId: null },
} as const
export const SOURCE_IDS = ['youtube', 'freecodecamp', 'cs50', 'github'] as const
export type SourceId = (typeof SOURCE_IDS)[number]

/** The language the material is in. YouTube ranks videos in this language first (relevanceLanguage). */
export const SPOKEN_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  vi: 'Vietnamese',
  ar: 'Arabic',
  hi: 'Hindi',
  'zh-Hans': 'Chinese (simplified)',
} as const
const SPOKEN_IDS = ['en', 'es', 'fr', 'pt', 'vi', 'ar', 'hi', 'zh-Hans'] as const
export type SpokenLanguage = (typeof SPOKEN_IDS)[number]

/** The programming language. `github` is GitHub's `language:` qualifier; `words` is added to the video search. */
export const PROGRAMMING_LANGUAGES = {
  any: { label: 'Any', github: null, words: '' },
  python: { label: 'Python', github: 'python', words: 'python' },
  javascript: { label: 'JavaScript', github: 'javascript', words: 'javascript' },
  html: { label: 'HTML and CSS', github: 'html', words: 'html css' },
  java: { label: 'Java', github: 'java', words: 'java' },
  cpp: { label: 'C++', github: 'cpp', words: 'c++' },
  csharp: { label: 'C#', github: 'csharp', words: 'c#' },
  lua: { label: 'Lua (Roblox)', github: 'lua', words: 'lua' },
  scratch: { label: 'Scratch', github: null, words: 'scratch' },
} as const
const PROGRAMMING_IDS = ['any', 'python', 'javascript', 'html', 'java', 'cpp', 'csharp', 'lua', 'scratch'] as const
export type ProgrammingLanguage = (typeof PROGRAMMING_IDS)[number]

/**
 * Licenses whose text may be copied into a lesson with attribution (SPDX ids, as GitHub reports
 * them). Anything else, including no license at all, is not offered.
 */
export const OPEN_LICENSES: Record<string, string> = {
  MIT: 'MIT License',
  'Apache-2.0': 'Apache License 2.0',
  'BSD-2-Clause': 'BSD 2-Clause License',
  'BSD-3-Clause': 'BSD 3-Clause License',
  '0BSD': 'BSD Zero Clause License',
  ISC: 'ISC License',
  Unlicense: 'The Unlicense',
  'CC0-1.0': 'CC0 1.0',
  'CC-BY-4.0': 'CC BY 4.0',
  'CC-BY-SA-4.0': 'CC BY-SA 4.0',
  'MPL-2.0': 'Mozilla Public License 2.0',
}

export const SearchRequest = z
  .object({
    topic: z.string().trim().min(2, 'Type a topic of at least 2 letters.').max(100, 'Keep the topic under 100 characters.'),
    sources: z.array(z.enum(SOURCE_IDS)).min(1, 'Pick at least one source.').max(SOURCE_IDS.length)
      .refine((s) => new Set(s).size === s.length, 'Each source once.'),
    spokenLanguage: z.enum(SPOKEN_IDS).default('en'),
    programmingLanguage: z.enum(PROGRAMMING_IDS).default('any'),
    /** Only videos the creator released under Creative Commons. */
    creativeCommonsOnly: z.boolean().default(false),
  })
  .strict()
export type SearchRequest = z.input<typeof SearchRequest>
export type ParsedSearch = z.output<typeof SearchRequest>

export const License = z.object({ id: z.string(), name: z.string(), open: z.boolean() })
export type License = z.infer<typeof License>

export const SourceResult = z.object({
  source: z.enum(SOURCE_IDS),
  kind: z.enum(['video', 'reading']),
  /** A YouTube video id, or `owner/repo` for GitHub. */
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  /** The channel or the repository owner. */
  by: z.string(),
  description: z.string(),
  license: License,
  durationS: z.number().nullable(),
  stars: z.number().nullable(),
  thumbnail: z.string().url().nullable(),
  publishedAt: z.string().nullable(),
})
export type SourceResult = z.infer<typeof SourceResult>

export const PROBLEMS = ['not_configured', 'quota', 'unavailable'] as const
export type Problem = (typeof PROBLEMS)[number]

export const SearchResponse = z.object({
  results: z.array(SourceResult),
  /** Sources that could not answer. The others still return results. */
  problems: z.array(z.object({ source: z.enum(SOURCE_IDS), error: z.enum(PROBLEMS) })),
})
export type SearchResponse = z.infer<typeof SearchResponse>

/** `owner/repo`, with GitHub's own limits on the characters and lengths. */
export const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/
export const ReadmeRequest = z.object({ repo: z.string().regex(REPO, 'Not a GitHub repository name.') }).strict()
export const ReadmeResponse = z.object({ title: z.string(), body: z.string(), url: z.string().url(), license: License })
export type ReadmeResponse = z.infer<typeof ReadmeResponse>

/** A failure inside a source adapter, already in the words the handler answers with. */
export class SourceError extends Error {
  readonly code: Problem | 'not_open_license' | 'no_readme' | 'not_found'
  constructor(code: SourceError['code']) {
    super(code)
    this.code = code
  }
}
