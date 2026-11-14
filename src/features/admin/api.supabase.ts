import { z } from 'zod'

import { getSupabase } from '@/lib/supabase'

const CreatedClass = z.string().uuid()

export interface CreateClassInput {
  schoolName: string
  name: string
  term?: string
}

export const AdminClass = z.object({
  id: z.string().uuid(),
  name: z.string(),
  term: z.string().nullable(),
})

export type AdminClass = z.infer<typeof AdminClass>

export const PublishedModule = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  version: z.number(),
  title: z.string(),
  summary: z.string(),
})

export type PublishedModule = z.infer<typeof PublishedModule>

export function isAdminDatabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function createClass({
  schoolName,
  name,
  term,
}: CreateClassInput): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase.rpc('create_class', {
    p_school_name: schoolName.trim(),
    p_name: name.trim(),
    p_term: term?.trim() || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return CreatedClass.parse(data)
}

export async function listAdminClasses(): Promise<AdminClass[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('classes')
    .select('id, name, term')
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return AdminClass.array().parse(data)
}

export async function listPublishedModules(): Promise<PublishedModule[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, version, title, summary')
    .eq('status', 'published')
    .order('title')
    .order('version', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return PublishedModule.array().parse(data)
}

export async function assignModule(
  classId: string,
  moduleId: string,
): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase.rpc('assign_module', {
    p_class_id: classId,
    p_module_id: moduleId,
    p_opens_at: null,
  })

  if (error) {
    throw new Error(error.message)
  }
}