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
