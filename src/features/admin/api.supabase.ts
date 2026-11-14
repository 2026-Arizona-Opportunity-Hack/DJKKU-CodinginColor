import { z } from 'zod'

import { getSupabase } from '@/lib/supabase'

const CreatedClass = z.string().uuid()

export interface CreateClassInput {
  schoolName: string
  name: string
  term?: string
}

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