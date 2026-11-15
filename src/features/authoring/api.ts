// What the authoring studio asks of the database. Reads go through row-level security (you see
// your own drafts and published modules; admins see all); every write is a function from lane A's
// contract (docs/contracts/database-api.md). Errors become messages an author can act on.
import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { fromDraftRows, slugify, type DraftPayload, type DraftRows } from '@shared/authoring/schemas'

/** The database writes plain-language errors (shown as is); a few constraint failures are reworded. */
export function authoringError(e: unknown): Error {
  const code = (e as { code?: string } | null)?.code
  if (code === '23505') return new Error('A module with a very similar title already exists. Change the title a little and save again.')
  if (code === '23514') return new Error(`The database refused some of that content. ${(e as { message?: string }).message ?? ''}`.trim())
  return new Error(toSessionError(e).message)
}

async function rpc<T>(fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw authoringError(error)
  return schema.parse(data)
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await query
  if (error) throw authoringError(error)
  return schema.parse(data)
}

// ---------- the module list ----------

const ModuleSummary = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  version: z.number(),
  status: z.enum(['draft', 'submitted', 'published']),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
})
export type ModuleSummary = z.infer<typeof ModuleSummary>

/** Your drafts and the published modules, newest first (there is no updated_at column). */
export const listMyModules = () =>
  rows(
    getSupabase().from('modules').select('id, slug, title, version, status, created_by, created_at, published_at').order('created_at', { ascending: false }),
    ModuleSummary.array(),
  )

/** A copy of a published module as the next version, as a new draft. Returns its id. */
export const newVersion = (moduleId: string) => rpc('new_module_version', { p_module_id: moduleId }, z.string().uuid())

// ---------- concepts ----------

const Concept = z.object({ id: z.string(), name: z.string() })
export type Concept = z.infer<typeof Concept>

export const listConcepts = () => rows(getSupabase().from('concepts').select('id, name').order('name'), Concept.array())

/** Adds (or renames) a concept. The id is the name as a slug, so the same name is the same concept. */
export async function upsertConcept(name: string): Promise<Concept> {
  const id = slugify(name)
  if (!id) throw new Error('Give the concept a name with letters or numbers.')
  await rpc('upsert_concept', { p_id: id, p_name: name.trim() }, z.unknown())
  return { id, name: name.trim() }
}

// ---------- one module ----------

const ModuleRow = z.object({ id: z.string().uuid(), slug: z.string(), version: z.number(), status: z.enum(['draft', 'submitted', 'published']), title: z.string(), summary: z.string() })
const LessonRow = z.object({ id: z.string(), position: z.number(), title: z.string() })
const ActivityRow = z.object({
  id: z.string(), lesson_id: z.string(), position: z.number(), kind: z.enum(['video', 'reading', 'check', 'worksheet', 'exit']),
  title: z.string(), content: z.unknown(), required: z.boolean(), concept_id: z.string().nullable(),
})
const AssessmentRow = z.object({ id: z.string(), kind: z.enum(['pre', 'post']) })
const ItemRow = z.object({ assessment_id: z.string(), position: z.number(), pair_key: z.string(), concept_id: z.string(), question_id: z.string(), content: z.unknown() })
const KeyList = z.array(z.object({ question_id: z.string(), key: z.unknown() }))

export type LoadedModule = ReturnType<typeof fromDraftRows> & {
  id: string
  slug: string
  version: number
  /** True when the answer keys could not be read (you do not own this module). */
  keysHidden: boolean
}

/** A module with everything under it, plus its answer keys, ready for the editor. */
export async function loadModule(moduleId: string): Promise<LoadedModule> {
  const sb = getSupabase()
  const module = await rows(sb.from('modules').select('id, slug, version, status, title, summary').eq('id', moduleId).single(), ModuleRow).catch((e) => {
    throw new Error(/PGRST116|0 rows/.test(String((e as Error).message)) || (e as { code?: string }).code === 'PGRST116' ? "We couldn't find that module." : (e as Error).message)
  })
  const [lessons, assessments] = await Promise.all([
    rows(sb.from('lessons').select('id, position, title').eq('module_id', moduleId), LessonRow.array()),
    rows(sb.from('assessments').select('id, kind').eq('module_id', moduleId), AssessmentRow.array()),
  ])
  const [activities, assessmentItems] = await Promise.all([
    lessons.length ? rows(sb.from('activities').select('id, lesson_id, position, kind, title, content, required, concept_id').in('lesson_id', lessons.map((l) => l.id)), ActivityRow.array()) : [],
    assessments.length ? rows(sb.from('assessment_items').select('assessment_id, position, pair_key, concept_id, question_id, content').in('assessment_id', assessments.map((a) => a.id)), ItemRow.array()) : [],
  ])
  // Keys come from their own functions. If we are not allowed to read them, say so instead of failing.
  let keysHidden = false
  const keysOf = async (fn: string, arg: string, id: string) => {
    try {
      return [id, await rpc(fn, { [arg]: id }, KeyList)] as const
    } catch {
      keysHidden = true
      return [id, []] as const
    }
  }
  const [activityKeys, assessmentKeys] = await Promise.all([
    Promise.all(activities.filter((a) => a.kind !== 'video' && a.kind !== 'reading').map((a) => keysOf('get_activity_keys', 'p_activity_id', a.id))),
    Promise.all(assessments.map((a) => keysOf('get_assessment_keys', 'p_assessment_id', a.id))),
  ])
  const draft: DraftRows = {
    module: { title: module.title, summary: module.summary, status: module.status },
    lessons, activities, assessments, assessmentItems,
    activityKeys: Object.fromEntries(activityKeys),
    assessmentKeys: Object.fromEntries(assessmentKeys),
  }
  return { ...fromDraftRows(draft), id: module.id, slug: module.slug, version: module.version, keysHidden }
}

/** Saves the whole draft in one transaction. Returns the module id. */
export const saveDraft = (payload: DraftPayload) => rpc('save_module_draft', { p_module: payload }, z.string().uuid())
