// What the admin console asks of the database. Reads go through row-level security (admins see
// everything); every write is a function from lane A's contract (docs/contracts/database-api.md).
import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'

/** Plain-language database errors are shown as is; a few constraint failures are reworded. */
export function adminError(e: unknown): Error {
  const code = (e as { code?: string } | null)?.code
  if (code === '23505') return new Error('That already exists.')
  return new Error(toSessionError(e).message)
}

/** publish_module raises "Fix these first: a; b". This keeps the list so the page can show it. */
export class ModuleProblems extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super('This module cannot be published yet.')
    this.name = 'ModuleProblems'
    this.problems = problems
  }
}

export async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await getSupabase().rpc(fn, args)
  if (error) {
    const m = /^Fix these first: (.*)$/s.exec(error.message ?? '')
    throw m ? new ModuleProblems(m[1]!.split('; ').filter(Boolean)) : adminError(error)
  }
  return data
}

export async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await query
  if (error) throw adminError(error)
  return schema.parse(data)
}

// ---------- publish queue ----------

const ModuleRow = z.object({
  id: z.string().uuid(),
  title: z.string(),
  version: z.number(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  profiles: z.object({ display_name: z.string() }).nullable(),
})
export type ModuleRow = z.infer<typeof ModuleRow>

const moduleQuery = (status: 'submitted' | 'published') =>
  getSupabase().from('modules').select('id, title, version, created_at, published_at, profiles(display_name)').eq('status', status)

export const listSubmitted = () => rows(moduleQuery('submitted').order('created_at', { ascending: true }), ModuleRow.array())
export const listPublished = () => rows(moduleQuery('published').order('published_at', { ascending: false }), ModuleRow.array())
export const publishModule = (id: string) => rpc('publish_module', { p_module_id: id })
export const sendBack = (id: string) => rpc('return_module_to_draft', { p_module_id: id })

// ---------- staff ----------

export const STAFF_ROLES = ['instructor', 'mentor', 'reviewer', 'cic_admin'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
export const ROLE_LABEL: Record<StaffRole, string> = { instructor: 'Instructor', mentor: 'Mentor', reviewer: 'Reviewer', cic_admin: 'CIC admin' }

export const setRole = (profileId: string, role: StaffRole, canAuthor: boolean) =>
  rpc('set_profile_role', { p_profile_id: profileId, p_role: role, p_can_author: role === 'instructor' && canAuthor })

const Invite = z.object({ email: z.string(), role: z.enum(STAFF_ROLES), can_author: z.boolean(), created_at: z.string(), accepted_at: z.string().nullable() })
export type Invite = z.infer<typeof Invite>
export const listInvites = () => rows(getSupabase().from('staff_invites').select('email, role, can_author, created_at, accepted_at').order('created_at', { ascending: false }), Invite.array())

const Staff = z.object({ id: z.string().uuid(), display_name: z.string(), role: z.enum(STAFF_ROLES), can_author: z.boolean() })
export type Staff = z.infer<typeof Staff>
export const listStaff = () =>
  rows(getSupabase().from('profiles').select('id, display_name, role, can_author').not('role', 'in', '(student,independent_student)').order('display_name'), Staff.array())

// ---------- classes ----------

const ClassRow = z.object({ id: z.string().uuid(), name: z.string(), term: z.string().nullable(), kind: z.enum(['school', 'open']), schools: z.object({ name: z.string() }).nullable() })
const MemberRow = z.object({ class_id: z.string().uuid(), profile_id: z.string().uuid().nullable(), member_role: z.enum(['student', 'instructor']), display_name: z.string() })
const ProgressRow = z.object({ class_id: z.string().uuid(), completion_pct: z.coerce.number() })

export interface ClassSummary {
  id: string
  name: string
  term: string | null
  school: string
  kind: 'school' | 'open'
  instructors: { profileId: string; name: string }[]
  students: number
  /** Average completion over the roster, or null when there are no students. */
  completionPct: number | null
}

/** Every class with who teaches it, how many students it has and its average completion. */
export async function listClasses(): Promise<ClassSummary[]> {
  const sb = getSupabase()
  const [classes, members, progress] = await Promise.all([
    rows(sb.from('classes').select('id, name, term, kind, schools(name)').order('name'), ClassRow.array()),
    rows(sb.from('class_members').select('class_id, profile_id, member_role, display_name'), MemberRow.array()),
    rows(sb.from('v_class_progress').select('class_id, completion_pct'), ProgressRow.array()),
  ])
  return classes.map((c) => {
    const mine = members.filter((m) => m.class_id === c.id)
    const pcts = progress.filter((p) => p.class_id === c.id).map((p) => p.completion_pct)
    return {
      id: c.id, name: c.name, term: c.term, kind: c.kind, school: c.schools?.name ?? 'No school',
      instructors: mine.filter((m) => m.member_role === 'instructor' && m.profile_id).map((m) => ({ profileId: m.profile_id!, name: m.display_name })),
      students: mine.filter((m) => m.member_role === 'student').length,
      completionPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    }
  })
}
export const addInstructor = (classId: string, profileId: string) => rpc('add_class_instructor', { p_class_id: classId, p_profile_id: profileId })
export const removeInstructor = (classId: string, profileId: string) => rpc('remove_class_instructor', { p_class_id: classId, p_profile_id: profileId })

// ---------- schools ----------

const School = z.object({ id: z.string().uuid(), name: z.string(), created_at: z.string() })
export type School = z.infer<typeof School>
export const listSchools = () => rows(getSupabase().from('schools').select('id, name, created_at').order('name'), School.array())

/** A new school, so instructors can create classes there. Admin only (row-level security). */
export async function addSchool(name: string): Promise<void> {
  const clean = name.trim()
  if (clean.length < 1 || clean.length > 120) throw new Error('Use 1 to 120 characters for the school name.')
  const { error } = await getSupabase().from('schools').insert({ name: clean })
  if (error) throw (error as { code?: string }).code === '23505' ? new Error('That school already exists.') : adminError(error)
}

// ---------- API keys ----------

export const API_SCOPES = [
  { value: 'progress', label: 'Progress', path: '/api/v1/completion' },
  { value: 'assessments', label: 'Assessments', path: '/api/v1/learning-gain' },
] as const

const Key = z.object({ id: z.string().uuid(), name: z.string(), scope: z.array(z.string()), created_at: z.string(), last_used_at: z.string().nullable(), revoked_at: z.string().nullable() })
export type ApiKey = z.infer<typeof Key>
/** Never the hash: it is not readable by any client. */
export const listKeys = () => rows(getSupabase().from('api_keys').select('id, name, scope, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }), Key.array())

const Created = z.object({ api_key_id: z.string(), raw_key: z.string() })
export async function createKey(name: string, scope: string[]): Promise<{ raw_key: string }> {
  return { raw_key: Created.parse(await rpc('create_api_key', { p_name: name.trim(), p_scope: scope })).raw_key }
}
export const revokeKey = (id: string) => rpc('revoke_api_key', { p_api_key_id: id })

// ---------- mentors ----------

const Mentor = z.object({ id: z.string().uuid(), display_name: z.string() })
export const listMentors = () => rows(getSupabase().from('profiles').select('id, display_name').eq('role', 'mentor').order('display_name'), Mentor.array())

const OpenStudent = z.object({ profile_id: z.string().uuid(), display_name: z.string() })
/** Students in the CIC Open class: the only students a mentor can be assigned to for now. */
export async function listOpenStudents() {
  const sb = getSupabase()
  const open = await rows(sb.from('classes').select('id').eq('kind', 'open'), z.object({ id: z.string() }).array())
  if (open.length === 0) return []
  return rows(sb.from('class_members').select('profile_id, display_name').eq('class_id', open[0]!.id).eq('member_role', 'student').not('profile_id', 'is', null).order('display_name'), OpenStudent.array())
}
export const assignMentor = (mentorId: string, studentId: string) => rpc('assign_mentor', { p_mentor_id: mentorId, p_student_id: studentId })
