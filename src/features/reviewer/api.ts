import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { SessionError, toSessionError } from '@/lib/session'

// Read-only access to PUBLISHED curriculum for reviewers (M9). The database decides what a
// reviewer may read (row-level security): published modules, their lessons, activities and
// test questions. Answer keys live in tables no reviewer can read, and this file never asks
// for them or for any student table. Keep it that way: the only tables named here are
// `modules` (with its lessons, activities and tests, embedded) and `concepts`.

const id = z.string()

const Activity = z.object({
  id,
  position: z.number(),
  kind: z.enum(['video', 'reading', 'check', 'worksheet', 'exit']),
  title: z.string(),
  required: z.boolean(),
  concept_id: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
})
const Lesson = z.object({ id, position: z.number(), title: z.string(), activities: z.array(Activity) })
const TestItem = z.object({
  id,
  position: z.number(),
  pair_key: z.string(),
  concept_id: z.string(),
  content: z.record(z.string(), z.unknown()),
})
const Test = z.object({
  id,
  kind: z.enum(['pre', 'post']),
  title: z.string(),
  assessment_items: z.array(TestItem),
})
const ModuleFields = {
  id,
  slug: z.string(),
  version: z.number(),
  title: z.string(),
  summary: z.string(),
  published_at: z.string().nullable(),
}
const ModuleDetailRow = z.object({
  ...ModuleFields,
  lessons: z.array(Lesson),
  assessments: z.array(Test),
})
const ModuleListRow = z.object({
  ...ModuleFields,
  lessons: z.array(z.object({ id, activities: z.array(z.object({ id })) })),
})
const ConceptRow = z.object({ id, name: z.string() })

export type ReviewActivity = z.infer<typeof Activity>
export type ReviewLesson = z.infer<typeof Lesson>
export type ReviewTest = z.infer<typeof Test>
export type ReviewModule = z.infer<typeof ModuleDetailRow>
export interface ModuleSummary {
  id: string
  title: string
  summary: string
  version: number
  publishedAt: string | null
  lessonCount: number
  activityCount: number
}

const UNEXPECTED = 'The server sent something unexpected. Try again.'

function parseRows<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new SessionError(UNEXPECTED, 'other', parsed.error)
  return parsed.data
}

const byPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function fetchModules(): Promise<ModuleSummary[]> {
  const { data, error } = await getSupabase()
    .from('modules')
    .select('id, slug, version, title, summary, published_at, lessons(id, activities(id))')
    .eq('status', 'published')
    .order('title')
  if (error) throw toSessionError(error)
  return parseRows(z.array(ModuleListRow), data).map((m) => ({
    id: m.id,
    title: m.title,
    summary: m.summary,
    version: m.version,
    publishedAt: m.published_at,
    lessonCount: m.lessons.length,
    activityCount: m.lessons.reduce((n, l) => n + l.activities.length, 0),
  }))
}

export async function fetchModule(moduleId: string): Promise<ReviewModule> {
  const notFound = () => new SessionError('That module was not found, or it is not published yet.', 'not_found')
  if (!UUID.test(moduleId)) throw notFound()

  const { data, error } = await getSupabase()
    .from('modules')
    .select(
      'id, slug, version, title, summary, published_at, ' +
        'lessons(id, position, title, activities(id, position, kind, title, required, concept_id, content)), ' +
        'assessments(id, kind, title, assessment_items(id, position, pair_key, concept_id, content))',
    )
    .eq('id', moduleId)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw toSessionError(error)
  if (!data) throw notFound()

  const module = parseRows(ModuleDetailRow, data)
  return {
    ...module,
    lessons: byPosition(module.lessons).map((l) => ({ ...l, activities: byPosition(l.activities) })),
    // Pre-test first, then post-test.
    assessments: [...module.assessments]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'pre' ? -1 : 1))
      .map((t) => ({ ...t, assessment_items: byPosition(t.assessment_items) })),
  }
}

/** Concept names for the tags on activities and questions. */
export async function fetchConcepts(): Promise<Map<string, string>> {
  const { data, error } = await getSupabase().from('concepts').select('id, name')
  if (error) throw toSessionError(error)
  return new Map(parseRows(z.array(ConceptRow), data).map((c) => [c.id, c.name]))
}
