import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { RadarRow } from './radar'

/** The most common first-try wrong answers in a class (instructor of the class or admin only). */
export async function loadMisconceptions(classId: string): Promise<RadarRow[]> {
  const { data, error } = await getSupabase().rpc('get_class_misconceptions', { p_class_id: classId })
  if (error) throw new Error(toSessionError(error).message)
  return RadarRow.array().parse(data)
}
