// Who is signed in, shared by the shell (nav, landing), the auth feature and, later, the
// player. Features may not import each other, so this lives in src/lib/.
import { useQuery, type QueryClient } from '@tanstack/react-query'
import type { AuthError, PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { ROLES } from '@shared/roles'
import type { FeatureModule } from './feature'
import { getSupabase } from './supabase'

/** The shape of the database function get_me(). */
export const MeSchema = z.object({
  profile_id: z.string(),
  role: z.enum(ROLES),
  can_author: z.boolean(),
  display_name: z.string(),
  class_id: z.string().nullable(),
  class_name: z.string().nullable(),
})
export type Me = z.infer<typeof MeSchema>

/** A failure with a message that is safe to show as is. `code` lets pages react to a few cases. */
export class SessionError extends Error {
  readonly code: 'not_found' | 'rate_limited' | 'offline' | 'demo' | 'other'
  constructor(message: string, code: SessionError['code'] = 'other', cause?: unknown) {
    super(message, { cause })
    this.name = 'SessionError'
    this.code = code
  }
}

/** Demo mode = no Supabase configured, so the app runs on sample data. Same rule as the player. */
export function isDemoMode(): boolean {
  const env = import.meta.env
  const source = env.VITE_DATA_SOURCE || (env.VITE_SUPABASE_URL ? 'supabase' : 'mock')
  return source === 'mock'
}

export const DEMO_ME: Me = {
  profile_id: '00000000-0000-4000-8000-000000000000',
  role: 'student',
  can_author: false,
  display_name: 'Demo student',
  class_id: 'demo',
  class_name: 'Demo class',
}

const RATE_LIMITED = 'Too many sign-ins from this network right now. Wait a minute and try again, or ask your instructor.'
const OFFLINE = "You're offline. Reconnect and try again."

/** Turns a Supabase Auth or PostgREST error into words a student can act on. */
export function toSessionError(e: unknown): SessionError {
  if (e instanceof SessionError) return e
  const err = (e ?? {}) as Partial<AuthError & PostgrestError> & { status?: number }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new SessionError(OFFLINE, 'offline', e)
  if (err.status === 429 || String(err.code).includes('rate_limit')) return new SessionError(RATE_LIMITED, 'rate_limited', e)
  if (err.code === 'anonymous_provider_disabled') {
    return new SessionError("Student sign-in isn't turned on yet. Tell your instructor.", 'other', e)
  }
  if (err.code === '42501' || err.code === 'PGRST301') {
    return new SessionError('You are signed out. Reload the page and try again.', 'other', e)
  }
  // The database raises plain-language messages (SQLSTATE P0001); those are written to be shown.
  if (err.code === 'P0001' && err.message) {
    return new SessionError(err.message, /not found/i.test(err.message) ? 'not_found' : 'other', e)
  }
  if (/fetch|network/i.test(err.message ?? '')) return new SessionError(OFFLINE, 'offline', e)
  return new SessionError('Something went wrong. Try again in a moment.', 'other', e)
}

/** Fetches who is signed in. No session means no call to the database. Demo mode returns a fixed student. */
export async function getMe(): Promise<Me | null> {
  if (isDemoMode()) return DEMO_ME
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  if (!data.session) return null
  const { data: me, error } = await sb.rpc('get_me')
  if (error) throw toSessionError(error)
  const parsed = MeSchema.nullable().safeParse(me)
  if (!parsed.success) throw new SessionError('The server sent something unexpected. Try again.', 'other', parsed.error)
  return parsed.data
}

/** Students sign in anonymously first, then claim a roster seat. Keeps an existing session. */
export async function ensureAnonymousSession(): Promise<void> {
  if (isDemoMode()) throw new SessionError('Demo mode: sign-in is turned off because no database is connected.', 'demo')
  const sb = getSupabase()
  const { data } = await sb.auth.getSession()
  if (data.session) return
  const { error } = await sb.auth.signInAnonymously()
  if (error) throw toSessionError(error)
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) return
  const { error } = await getSupabase().auth.signOut()
  if (error) throw toSessionError(error)
}

/** Where a signed-in person starts. */
export function homePathFor(me: Me | null): string {
  if (!me) return '/sign-in'
  switch (me.role) {
    case 'student':
    case 'independent_student':
      return '/learn'
    case 'instructor':
    case 'mentor':
      return '/instructor'
    case 'cic_admin':
      return '/admin'
    case 'reviewer':
      return '/review'
  }
}

export const isStaff = (me: Me) => me.role !== 'student' && me.role !== 'independent_student'

/** Navigation only; row-level security is the real gate. */
export function canSeeFeature(feature: FeatureModule, me: Me | null): boolean {
  if (!me) return feature.showSignedOut ? true : !feature.roles
  if (feature.showSignedOut === 'only') return false
  if (!feature.roles) return true
  if (!feature.roles.includes(me.role)) return false
  return !feature.needsAuthorFlag || me.can_author || me.role === 'cic_admin'
}

export const ME_KEY = ['me'] as const
export const useMe = () => useQuery({ queryKey: ME_KEY, queryFn: getMe, staleTime: 60_000, retry: false })
/** Call after signing in or out so the nav and pages pick up the new person. */
export const invalidateMe = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ME_KEY })
