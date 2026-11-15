import type { ActivityKind, AuthoredQuestion } from '@shared/authoring/schemas'

// The editor's form values. One loose activity shape (every kind's fields optional) keeps the
// field paths simple; authoredModule, the real contract, still validates all of it on save.
export type ActivityFV = {
  kind: ActivityKind
  title: string
  required: boolean
  conceptId?: string | null
  youtubeUrl?: string
  transcript?: string
  body?: string
  questions?: AuthoredQuestion[]
  prompt?: string
  starter?: string
  predict?: string
  tests?: string[]
}
export type LessonFV = { title: string; activities: ActivityFV[] }
export type ModuleFV = { title: string; summary: string; status?: 'draft' | 'submitted' | 'published'; lessons: LessonFV[] }

export const KIND_LABEL: Record<ActivityKind, string> = {
  video: 'Video',
  reading: 'Reading',
  check: 'Check',
  worksheet: 'Worksheet',
  exit: 'Exit ticket',
  code: 'Code (Python)',
}
export const KINDS = Object.keys(KIND_LABEL) as ActivityKind[]

/**
 * A "Coder spotlight" reading: a short story of a coder students can see themselves in. Culturally
 * responsive computing (Scott, Sheridan and Clark 2015) and belonging research (Walton and Cohen 2011)
 * both point to this. The text is a placeholder: CIC fills in a real person, with their permission.
 */
export function coderSpotlight(): ActivityFV {
  return {
    kind: 'reading',
    title: 'Coder spotlight',
    required: false,
    body: [
      '## Coder spotlight: [name]',
      '',
      '**[Name]** is a [job, for example "game developer"] at [company or school]. They grew up in [place] and wrote their first program at [age].',
      '',
      '> "[A sentence in their words about getting stuck and keeping going.]"',
      '',
      '**What they build:** [one or two sentences].',
      '',
      '**What this has to do with today:** [link the lesson to their work, for example "they use loops to move every character in a game"].',
      '',
      '_Placeholder: replace every [bracket] with the real story of a coder, with their permission, before publishing._',
    ].join(String.fromCharCode(10)),
  }
}

export function newActivity(kind: ActivityKind): ActivityFV {
  const base = { kind, title: '', required: true }
  if (kind === 'video') return { ...base, youtubeUrl: '', transcript: '' }
  if (kind === 'reading') return { ...base, body: '' }
  if (kind === 'code') return { ...base, prompt: '', starter: '', predict: '', tests: [] }
  return { ...base, questions: [] }
}
