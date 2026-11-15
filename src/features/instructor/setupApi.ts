// What the class setup screens ask of the database. Reads go through row-level security
// (an instructor only sees their own classes); every write is a function in lane A's contract
// (docs/contracts/database-api.md). Errors become messages a teacher can act on.
import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { CreateClassInput } from '@shared/classes'

/** The database writes plain-language errors; this only rewords the one the page can say better. */
export function setupError(e: unknown): Error {
  const message = toSessionError(e).message
  return new Error(/not set up yet/i.test(message) ? "That school isn't set up yet. Ask a CIC admin to add it." : message)
}

async function call<T>(fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) throw setupError(error)
  return schema.parse(data)
}

export const createClass = (input: CreateClassInput) =>
  call('create_class', { p_school_name: input.schoolName, p_name: input.name, p_term: input.term || null }, z.object({ class_id: z.string().uuid() }))

/** Shown once. A new code replaces the old link. */
export const createJoinCode = (classId: string) =>
  call('create_join_code', { p_class_id: classId }, z.object({ join_code: z.string() }))

export const assignModule = (classId: string, moduleId: string) =>
  call('assign_module', { p_class_id: classId, p_module_id: moduleId }, z.unknown())

const PublishedModule = z.object({ id: z.string().uuid(), title: z.string(), version: z.number() })
export type PublishedModule = z.infer<typeof PublishedModule>

export async function listPublishedModules(): Promise<PublishedModule[]> {
  const { data, error } = await getSupabase()
    .from('modules').select('id, title, version').eq('status', 'published').order('title').order('version', { ascending: false })
  if (error) throw setupError(error)
  return PublishedModule.array().parse(data)
}

const ClassModuleRow = z.object({
  position: z.number(),
  module_id: z.string().uuid(),
  modules: z.object({ title: z.string(), version: z.number() }),
})
export type ClassModule = { position: number; moduleId: string; title: string; version: number }

export async function listClassModules(classId: string): Promise<ClassModule[]> {
  const { data, error } = await getSupabase()
    .from('class_modules').select('position, module_id, modules(title, version)').eq('class_id', classId).order('position')
  if (error) throw setupError(error)
  return ClassModuleRow.array().parse(data).map((r) => ({ position: r.position, moduleId: r.module_id, title: r.modules.title, version: r.modules.version }))
}

/**
 * Late joiners: start these roster seats at a module (every earlier module is skipped for
 * them). `null` = from the beginning. Works before the students have signed in.
 */
export const setStartModule = (memberIds: string[], moduleId: string | null) =>
  call('set_start_module', { p_member_ids: memberIds, p_module_id: moduleId },
    z.object({ students: z.number(), start_module_id: z.string().uuid().nullable(), skipped_modules: z.number() }))

const Seat = z.object({ id: z.string().uuid(), display_name: z.string(), profile_id: z.string().uuid().nullable() })
const Skip = z.object({ member_id: z.string().uuid(), module_id: z.string().uuid() })
export type Placement = { memberId: string; name: string; joined: boolean; startModuleId: string | null }

/** Each student seat and the module it starts at (null = the class's first module). Two reads, no N+1. */
export async function listPlacements(classId: string, modules: ClassModule[]): Promise<Placement[]> {
  const sb = getSupabase()
  const [seats, skips] = await Promise.all([
    sb.from('class_members').select('id, display_name, profile_id').eq('class_id', classId).eq('member_role', 'student').order('display_name'),
    sb.from('module_skips').select('member_id, module_id').eq('class_id', classId),
  ])
  if (seats.error) throw setupError(seats.error)
  if (skips.error) throw setupError(skips.error)
  const skipped = new Map<string, Set<string>>()
  for (const s of Skip.array().parse(skips.data)) {
    skipped.set(s.member_id, (skipped.get(s.member_id) ?? new Set()).add(s.module_id))
  }
  return Seat.array().parse(seats.data).map((s) => {
    const mine = skipped.get(s.id)
    // The start is the first module (in class order) that is not skipped.
    const start = mine ? modules.find((m) => !mine.has(m.moduleId))?.moduleId ?? null : null
    return { memberId: s.id, name: s.display_name, joined: s.profile_id !== null, startModuleId: start }
  })
}
