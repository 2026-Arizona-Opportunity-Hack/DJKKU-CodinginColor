import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES } from '@shared/roles'
import type { FeatureModule } from './feature'
import { canSeeFeature, DEMO_ME, getMe, homePathFor, type Me } from './session'

const h = vi.hoisted(() => ({ session: null as unknown, rpc: vi.fn() }))
vi.mock('./supabase', () => ({
  getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: h.session } }) }, rpc: h.rpc }),
}))

const me = (role: Me['role'], extra: Partial<Me> = {}): Me => ({
  profile_id: 'p', role, can_author: false, display_name: 'Pat', class_id: null, class_name: null, ...extra,
})
const feature = (extra: Partial<FeatureModule>): FeatureModule => ({ id: 'x', label: 'X', path: '/x', routes: [], ...extra })

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  h.session = null
  h.rpc.mockReset()
})

describe('homePathFor', () => {
  it('maps every role, and signed out goes to /sign-in', () => {
    expect(homePathFor(null)).toBe('/sign-in')
    expect(Object.fromEntries(ROLES.map((r) => [r, homePathFor(me(r))]))).toEqual({
      student: '/learn', independent_student: '/learn', mentor: '/sign-in',
      instructor: '/instructor', cic_admin: '/admin', reviewer: '/review',
    })
  })
})

describe('getMe', () => {
  it('returns null without calling the database when nobody is signed in', async () => {
    expect(await getMe()).toBeNull()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('parses what get_me returns', async () => {
    h.session = { access_token: 't' }
    h.rpc.mockResolvedValue({ data: me('instructor'), error: null })
    expect(await getMe()).toMatchObject({ role: 'instructor' })
    expect(h.rpc).toHaveBeenCalledWith('get_me')
  })

  it('rejects a role the app does not know', async () => {
    h.session = { access_token: 't' }
    h.rpc.mockResolvedValue({ data: { ...me('student'), role: 'admin' }, error: null })
    await expect(getMe()).rejects.toThrow(/unexpected/)
  })

  it('is a fixed demo student in demo mode, with no database call', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    expect(await getMe()).toEqual(DEMO_ME)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})

describe('canSeeFeature', () => {
  const admin = feature({ roles: ['cic_admin'] })
  const author = feature({ roles: ['instructor', 'cic_admin'], needsAuthorFlag: true })
  const learn = feature({ roles: ['student', 'independent_student'], showSignedOut: 'also' })
  const signIn = feature({ showSignedOut: 'only' })

  it('shows Admin to a CIC admin and not to a student', () => {
    expect(canSeeFeature(admin, me('cic_admin'))).toBe(true)
    expect(canSeeFeature(admin, me('student'))).toBe(false)
    expect(canSeeFeature(admin, null)).toBe(false)
  })

  it('shows Author to an instructor only when can_author is on, and always to a CIC admin', () => {
    expect(canSeeFeature(author, me('instructor'))).toBe(false)
    expect(canSeeFeature(author, me('instructor', { can_author: true }))).toBe(true)
    expect(canSeeFeature(author, me('cic_admin'))).toBe(true)
  })

  it('keeps Learn visible when signed out and hides Sign in once signed in', () => {
    expect(canSeeFeature(learn, null)).toBe(true)
    expect(canSeeFeature(learn, me('mentor'))).toBe(false)
    expect(canSeeFeature(signIn, null)).toBe(true)
    expect(canSeeFeature(signIn, me('student'))).toBe(false)
  })
})
