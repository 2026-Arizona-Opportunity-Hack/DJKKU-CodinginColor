import { z } from 'zod'

import { getSupabase } from '@/lib/supabase'

export const InstructorClass = z.object({
  id: z.string().uuid(),
  name: z.string(),
  term: z.string().nullable(),
  kind: z.enum(['school', 'open']),
})

export type InstructorClass = z.infer<typeof InstructorClass>

export const ImportedRosterMember = z.object({
  member_id: z.string().uuid(),
  display_name: z.string(),
  login_code: z.string(),
})

export type ImportedRosterMember = z.infer<typeof ImportedRosterMember>

export function isInstructorDatabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function listInstructorClasses(): Promise<InstructorClass[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('classes')
    .select('id, name, term, kind')
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return InstructorClass.array().parse(data)
}

export async function importRoster(
  classId: string,
  names: string[],
): Promise<ImportedRosterMember[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase.rpc('import_roster', {
    p_class_id: classId,
    p_names: names,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ImportedRosterMember.array().parse(data)
}