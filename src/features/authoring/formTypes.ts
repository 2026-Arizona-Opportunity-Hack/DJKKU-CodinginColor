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

export function newActivity(kind: ActivityKind): ActivityFV {
  const base = { kind, title: '', required: true }
  if (kind === 'video') return { ...base, youtubeUrl: '', transcript: '' }
  if (kind === 'reading') return { ...base, body: '' }
  if (kind === 'code') return { ...base, prompt: '', starter: '', predict: '', tests: [] }
  return { ...base, questions: [] }
}
