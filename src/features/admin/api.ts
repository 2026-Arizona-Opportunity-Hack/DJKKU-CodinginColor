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

// Every staff role the database knows, so existing rows always load and show a label.
export const ALL_STAFF_ROLES = ['instructor', 'mentor', 'reviewer', 'cic_admin'] as const
export type StaffRole = (typeof ALL_STAFF_ROLES)[number]
// The roles an admin can give. 'mentor' exists in the database, but mentors have no screens yet (next
// version: assigning students to a mentor), so it is not offered.
export const STAFF_ROLES: readonly StaffRole[] = ['instructor', 'reviewer', 'cic_admin']
export const ROLE_LABEL: Record<StaffRole, string> = { instructor: 'Instructor', mentor: 'Mentor', reviewer: 'Reviewer', cic_admin: 'CIC admin' }

export const setRole = (profileId: string, role: StaffRole, canAuthor: boolean) =>
  rpc('set_profile_role', { p_profile_id: profileId, p_role: role, p_can_author: role === 'instructor' && canAuthor })

const Invite = z.object({ email: z.string(), role: z.enum(ALL_STAFF_ROLES), can_author: z.boolean(), created_at: z.string(), accepted_at: z.string().nullable() })
export type Invite = z.infer<typeof Invite>
export const listInvites = () => rows(getSupabase().from('staff_invites').select('email, role, can_author, created_at, accepted_at').order('created_at', { ascending: false }), Invite.array())

// ---------- read API keys ----------

/** What a key may read: `progress` is /api/v1/completion, `assessments` is /api/v1/learning-gain. */
export const API_SCOPES = ['progress', 'assessments'] as const
export type ApiScope = (typeof API_SCOPES)[number]
const ApiKeyRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scope: z.array(z.enum(API_SCOPES)),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
})
export type ApiKeyRow = z.infer<typeof ApiKeyRow>
/** Every key, newest first. Only the name and dates: the key itself is stored only as a hash. */
export const listApiKeys = () =>
  rows(getSupabase().from('api_keys').select('id, name, scope, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }), ApiKeyRow.array())
/** A new key. `raw_key` is returned this one time and never again. */
export const createApiKey = async (name: string, scope: ApiScope[]) =>
  z.object({ api_key_id: z.string().uuid(), raw_key: z.string().startsWith('oh_') }).parse(await rpc('create_api_key', { p_name: name.trim(), p_scope: scope }))
/** Stops a key working at once. It stays in the list, marked revoked. */
export const revokeApiKey = (id: string) => rpc('revoke_api_key', { p_api_key_id: id })

const Removal = z.object({ classes_left_without_instructor: z.array(z.object({ id: z.string(), name: z.string() })) })
export type Removal = z.infer<typeof Removal>
/** What removing this person would do, without doing it: the classes left with no instructor. */
export const previewRemoval = async (profileId: string): Promise<Removal> =>
  Removal.parse(await rpc('remove_staff', { p_profile_id: profileId, p_dry_run: true }))
/** Takes away staff access (the account and everything they made stay). Inviting again restores it. */
export const removeStaff = (profileId: string) => rpc('remove_staff', { p_profile_id: profileId, p_dry_run: false })
/** Deletes an invite nobody used yet. */
export const cancelInvite = (email: string) => rpc('cancel_staff_invite', { p_email: email })

const Staff = z.object({ id: z.string().uuid(), display_name: z.string(), role: z.enum(ALL_STAFF_ROLES), can_author: z.boolean() })
export type Staff = z.infer<typeof Staff>
export const listStaff = () =>
  rows(getSupabase().from('profiles').select('id, display_name, role, can_author').not('role', 'in', '(student,independent_student)').order('display_name'), Staff.array())
