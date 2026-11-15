import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { createSupabaseApi } from '../api.supabase'

type Row = Record<string, unknown>
const ME = { profile_id: 'p1', role: 'student', can_author: false, display_name: 'Demo S.', class_id: 'c1', class_name: 'Period 1' }

/** A stand-in for the Supabase client: auth calls plus rpc() with canned answers. */
function fake(init: { session?: boolean; anonError?: unknown; rpc?: Record<string, (args: Row) => { data?: unknown; error?: unknown }> } = {}) {
  let has = init.session ?? false
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: has ? { access_token: 't' } : null } })),
    signInAnonymously: vi.fn(async () => {
      if (init.anonError) return { data: {}, error: init.anonError }
      has = true
      return { data: {}, error: null }
    }),
    signOut: vi.fn(async () => ({ error: null })),
  }
  const rpc = vi.fn((fn: string, args: Row = {}) => {
    const run = async () => ({ error: null, status: 200, ...(init.rpc?.[fn]?.(args) ?? { data: null }) })
    const chain = { setHeader: () => chain, abortSignal: () => chain, then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => run().then(ok, bad) }
    return chain
  })
  return { sb: { auth, rpc } as unknown as SupabaseClient, auth, rpc }
}

describe('getMe', () => {
  it('is null without a session and never calls the database', async () => {
    const { sb, rpc } = fake()
    expect(await createSupabaseApi(sb).getMe()).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reads the get_me shape, including a student with no class and a staff member', async () => {
    const { sb } = fake({ session: true, rpc: { get_me: () => ({ data: ME }) } })
    expect(await createSupabaseApi(sb).getMe()).toEqual(ME)
    const none = fake({ session: true, rpc: { get_me: () => ({ data: { ...ME, role: 'instructor', class_id: null, class_name: null } }) } })
    expect(await createSupabaseApi(none.sb).getMe()).toMatchObject({ role: 'instructor', class_id: null, class_name: null })
  })

  it('refuses an answer that is not the get_me shape', async () => {
    const { sb } = fake({ session: true, rpc: { get_me: () => ({ data: { display_name: 'x', class_id: 'c', class_name: 'n' } }) } })
    await expect(createSupabaseApi(sb).getMe()).rejects.toMatchObject({ code: 'bad_response' })
  })
})

describe('selfRegister', () => {
  const ok = { self_register: () => ({ data: { class_id: 'open', login_code: 'AAAA-BBBB-CCCC-DDDD' } }) }

  it('signs in anonymously when there is no session, then calls the self_register function', async () => {
    const { sb, auth, rpc } = fake({ rpc: ok })
    expect(await createSupabaseApi(sb).selfRegister('Sam P.')).toEqual({ class_id: 'open', login_code: 'AAAA-BBBB-CCCC-DDDD' })
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('self_register', { p_display_name: 'Sam P.' })
  })

  it('keeps an existing session instead of signing in again', async () => {
    const { sb, auth } = fake({ session: true, rpc: ok })
    await createSupabaseApi(sb).selfRegister('Sam P.')
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('maps a 429 from anonymous sign-in to the rate-limit message', async () => {
    const { sb, rpc } = fake({ anonError: { status: 429, code: 'over_request_rate_limit', message: 'rate limit' } })
    await expect(createSupabaseApi(sb).selfRegister('Sam P.')).rejects.toMatchObject({ code: 'rate_limited' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['This device already belongs to a class', 'already_in_class'],
    ['Enter a display name (no email) up to 80 characters', 'invalid_name'],
    ['This account cannot self-register', 'wrong_account'],
  ])('turns the database message "%s" into %s', async (message, code) => {
    const { sb } = fake({ session: true, rpc: { self_register: () => ({ error: { code: 'P0001', message } }) } })
    await expect(createSupabaseApi(sb).selfRegister('Sam P.')).rejects.toMatchObject({ code })
  })
})

describe('the old endpoint is gone', () => {
  it('never posts to /api/self-register', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { sb } = fake({ session: true, rpc: { self_register: () => ({ data: { class_id: 'open', login_code: 'AAAA-BBBB-CCCC-DDDD' } }) } })
    await createSupabaseApi(sb).selfRegister('Sam P.')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
