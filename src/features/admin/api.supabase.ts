import { z } from 'zod'

import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'

const Profile = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  role: z.enum([
    'student',
    'independent_student',
    'mentor',
    'instructor',
    'cic_admin',
    'reviewer',
  ]),
  can_author: z.boolean(),
})

export type AdminProfile = z.infer<typeof Profile>

const AdminClass = z.object({
  id: z.string().uuid(),
  name: z.string(),
  term: z.string().nullable(),
  school_id: z.string().uuid().nullable(),
})

export type AdminClass = z.infer<typeof AdminClass>

const School = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export type AdminSchool = z.infer<typeof School>

function adminError(error: unknown): Error {
  return new Error(toSessionError(error).message)
}

export async function listProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, role, can_author')
    .order('display_name')

  if (error) throw adminError(error)

  return Profile.array().parse(data)
}

const ClassInstructor = z.object({ class_id: z.string().uuid(), profile_id: z.string().uuid() })
export type ClassInstructor = z.infer<typeof ClassInstructor>

/** Who teaches which class (instructor seats). Names come from the profiles list. */
export async function listClassInstructors(): Promise<ClassInstructor[]> {
  const { data, error } = await getSupabase()
    .from('class_members')
    .select('class_id, profile_id')
    .eq('member_role', 'instructor')

  if (error) throw adminError(error)

  return ClassInstructor.array().parse(data)
}

export async function listClasses(): Promise<AdminClass[]> {
  const { data, error } = await getSupabase()
    .from('classes')
    .select('id, name, term, school_id')
    .eq('kind', 'school')
    .order('name')

  if (error) throw adminError(error)

  return AdminClass.array().parse(data)
}

export async function listSchools(): Promise<AdminSchool[]> {
  const { data, error } = await getSupabase()
    .from('schools')
    .select('id, name')
    .order('name')

  if (error) throw adminError(error)

  return School.array().parse(data)
}

export async function inviteStaff(
  email: string,
  role: 'mentor' | 'instructor' | 'cic_admin' | 'reviewer',
  canAuthor: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('invite_staff', {
    p_email: email.trim().toLowerCase(),
    p_role: role,
    p_can_author: canAuthor,
  })

  if (error) throw adminError(error)
}

export async function addClassInstructor(
  classId: string,
  profileId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('add_class_instructor', {
    p_class_id: classId,
    p_profile_id: profileId,
  })

  if (error) throw adminError(error)
}