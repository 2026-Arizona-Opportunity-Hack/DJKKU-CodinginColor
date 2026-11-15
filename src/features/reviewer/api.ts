// Read-only. Everything here is a SELECT on published curriculum (row-level security lets a reviewer
// read exactly that). There is no write call in this file, and no call to get_activity_keys or
// get_assessment_keys: reviewers never see answer keys.
import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { questionContent } from '@shared/authoring/schemas'

function reviewError(e: unknown): Error {
  return new Error(toSessionError(e).message)
}

async function select<T>(query: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await query
  if (error) throw reviewError(error)
  return schema.parse(data)
}

const ModuleSummaryRow = z.object({
  id: z.string().uuid(),
  title: z.string(),
  version: z.number(),
  summary: z.string(),
  published_at: z.string().nullable(),
  lessons: z.array(z.object({ activities: z.array(z.object({ concept_id: z.string().nullable() })) })),
  assessments: z.array(z.object({ assessment_items: z.array(z.object({ concept_id: z.string() })) })),
})
const Concept = z.object({ id: z.string(), name: z.string() })

export interface ModuleSummary {
  id: string
  title: string
  version: number
  summary: string
  publishedAt: string | null
  lessons: number
  activities: number
  concepts: string[]
}

/** Published modules with counts and the concepts they cover. */
export async function listPublishedModules(): Promise<ModuleSummary[]> {
  const sb = getSupabase()
  const [modules, concepts] = await Promise.all([
    select(
      sb.from('modules').select('id, title, version, summary, published_at, lessons(activities(concept_id)), assessments(assessment_items(concept_id))').eq('status', 'published').order('title'),
      ModuleSummaryRow.array(),
    ),
    select(sb.from('concepts').select('id, name'), Concept.array()),
  ])
  const names = new Map(concepts.map((c) => [c.id, c.name]))
  return modules.map((m) => {
    const ids = new Set([...m.lessons.flatMap((l) => l.activities.map((a) => a.concept_id)), ...m.assessments.flatMap((a) => a.assessment_items.map((i) => i.concept_id))].filter((x): x is string => Boolean(x)))
    return {
      id: m.id, title: m.title, version: m.version, summary: m.summary, publishedAt: m.published_at,
      lessons: m.lessons.length, activities: m.lessons.reduce((n, l) => n + l.activities.length, 0),
      concepts: [...ids].map((i) => names.get(i) ?? i).sort(),
    }
  })
}

const Video = z.object({ embedUrl: z.string(), transcript: z.string().optional() })
const Reading = z.object({ body: z.string() })
const Questions = z.object({ questions: z.array(questionContent) })

const ActivityRow = z.object({
  id: z.string(), position: z.number(), kind: z.enum(['video', 'reading', 'check', 'worksheet', 'exit']),
  title: z.string(), required: z.boolean(), concept_id: z.string().nullable(), content: z.unknown(),
})
const ModuleRow = z.object({
  id: z.string().uuid(), title: z.string(), version: z.number(), summary: z.string(), published_at: z.string().nullable(),
  lessons: z.array(z.object({ id: z.string(), position: z.number(), title: z.string(), activities: z.array(ActivityRow) })),
  assessments: z.array(z.object({
    kind: z.enum(['pre', 'post']),
    assessment_items: z.array(z.object({ position: z.number(), pair_key: z.string(), concept_id: z.string(), content: questionContent })),
  })),
})

export type ReviewContent =
  | { kind: 'video'; embedUrl: string; transcript?: string }
  | { kind: 'reading'; body: string }
  | { kind: 'questions'; questions: z.infer<typeof questionContent>[] }
  | { kind: 'unreadable' }

export interface ReviewModule {
  id: string
  title: string
  version: number
  summary: string
  publishedAt: string | null
  lessons: { id: string; title: string; activities: { id: string; title: string; kind: string; required: boolean; concept: string | null; content: ReviewContent }[] }[]
  /** Test items grouped by pair key, so alignment between pre and post can be judged. */
  pairs: { pairKey: string; concept: string; pre?: z.infer<typeof questionContent>; post?: z.infer<typeof questionContent> }[]
}

function toContent(kind: string, raw: unknown): ReviewContent {
  if (kind === 'video') {
    const p = Video.safeParse(raw)
    return p.success ? { kind: 'video', ...p.data } : { kind: 'unreadable' }
  }
  if (kind === 'reading') {
    const p = Reading.safeParse(raw)
    return p.success ? { kind: 'reading', body: p.data.body } : { kind: 'unreadable' }
  }
  const p = Questions.safeParse(raw) // strict: content with a key field in it is refused, not shown
  return p.success ? { kind: 'questions', questions: p.data.questions } : { kind: 'unreadable' }
}

/** One published module, all of it, in order. */
export async function loadModule(moduleId: string): Promise<ReviewModule> {
  const sb = getSupabase()
  const [m, concepts] = await Promise.all([
    select(
      sb.from('modules').select('id, title, version, summary, published_at, lessons(id, position, title, activities(id, position, kind, title, required, concept_id, content)), assessments(kind, assessment_items(position, pair_key, concept_id, content))').eq('id', moduleId).eq('status', 'published').maybeSingle(),
      ModuleRow.nullable(),
    ),
    select(sb.from('concepts').select('id, name'), Concept.array()),
  ])
  if (!m) throw new Error("We couldn't find that module. It may not be published.")
  const names = new Map(concepts.map((c) => [c.id, c.name]))
  const byPair = new Map<string, ReviewModule['pairs'][number]>()
  for (const t of m.assessments) {
    for (const i of [...t.assessment_items].sort((a, b) => a.position - b.position)) {
      const row = byPair.get(i.pair_key) ?? { pairKey: i.pair_key, concept: names.get(i.concept_id) ?? i.concept_id }
      row[t.kind] = i.content
      byPair.set(i.pair_key, row)
    }
  }
  return {
    id: m.id, title: m.title, version: m.version, summary: m.summary, publishedAt: m.published_at,
    lessons: [...m.lessons].sort((a, b) => a.position - b.position).map((l) => ({
      id: l.id, title: l.title,
      activities: [...l.activities].sort((a, b) => a.position - b.position).map((a) => ({
        id: a.id, title: a.title, kind: a.kind, required: a.required,
        concept: a.concept_id ? (names.get(a.concept_id) ?? a.concept_id) : null,
        content: toContent(a.kind, a.content),
      })),
    })),
    pairs: [...byPair.values()],
  }
}
