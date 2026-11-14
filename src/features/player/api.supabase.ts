/**
 * StudentApi over Supabase RPCs (lane A) and Pages Functions (lane E), exactly per the
 * PROPOSED contract in docs/contracts/student-api.md. If lanes A/E rename or reshape
 * anything, this file is the only one that changes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { env } from './env'
import { log } from '@/lib/log'
import { newRequestId } from '@/lib/requestId'
import { getSupabase } from '@/lib/supabase'

import type { Me, StudentApi } from './api'
import { ApiError, fromHttpStatus, fromRpcError, isOnline } from './errors'
import {
  Activity,
  Assessment,
  AssessmentResult,
  ClaimResult,
  ClassOutline,
  HintResult,
  ImportResult,
  MyClass,
  MyProgress,
  NextActivity,
  OpenModule,
  RosterSeat,
  SelfRegisterResult,
  SubmitResult,
} from './types'

const TIMEOUT_MS = 15_000
const ME_KEY = 'cic.me.v1'

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown, requestId: string, fn: string): z.infer<S> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiError('bad_response', { requestId, cause: new Error(`${fn}: ${parsed.error.message}`) })
  return parsed.data
}

export function createSupabaseApi(sb: SupabaseClient = getSupabase()): StudentApi {
  async function rpc<S extends z.ZodTypeAny>(fn: string, args: Record<string, unknown>, schema: S): Promise<z.infer<S>> {
    const requestId = newRequestId()
    if (!isOnline()) throw new ApiError('offline', { requestId })
    const started = performance.now()
    let result
    try {
      result = await sb.rpc(fn, args).setHeader('x-request-id', requestId).abortSignal(AbortSignal.timeout(TIMEOUT_MS))
    } catch (cause) {
      throw fromRpcError(cause, requestId)
    }
    const duration_ms = Math.round(performance.now() - started)
    if (result.error) {
      log.debug('rpc.fail', { method: 'rpc', path: fn, status: result.status, duration_ms, requestId })
      throw fromRpcError(result.error, requestId)
    }
    log.debug('rpc.ok', { method: 'rpc', path: fn, status: result.status, duration_ms, requestId })
    return parse(schema, result.data, requestId, fn)
  }

  async function postFunction<S extends z.ZodTypeAny>(path: string, body: unknown, schema: S, auth: boolean): Promise<z.infer<S>> {
    const requestId = newRequestId()
    if (!isOnline()) throw new ApiError('offline', { requestId })
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-request-id': requestId }
    if (auth) {
      const { data } = await sb.auth.getSession()
      if (!data.session) throw new ApiError('unauthenticated', { requestId })
      headers.authorization = `Bearer ${data.session.access_token}`
    }
    const started = performance.now()
    let res: Response
    try {
      res = await fetch(`${env.apiBase}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (cause) {
      throw new ApiError(isOnline() ? 'unavailable' : 'offline', { requestId, cause })
    }
    const serverId = res.headers.get('x-request-id') ?? requestId
    log.debug('fn.response', { method: 'POST', path, status: res.status, duration_ms: Math.round(performance.now() - started), requestId: serverId })
    if (!res.ok) throw fromHttpStatus(res.status, serverId, new Error(`${path} answered ${res.status}`))
    let json: unknown
    try {
      json = await res.json()
    } catch (cause) {
      throw new ApiError('bad_response', { requestId: serverId, cause })
    }
    return parse(schema, json, serverId, path)
  }

  /** Students without an account get an anonymous Supabase user; claiming a code binds it. */
  async function ensureSession(): Promise<void> {
    const { data } = await sb.auth.getSession()
    if (data.session) return
    const { error } = await sb.auth.signInAnonymously()
    if (error) throw fromRpcError(error, newRequestId())
  }

  function remember(me: Me): Me {
    window.localStorage.setItem(ME_KEY, JSON.stringify(me))
    return me
  }

  return {
    source: 'supabase',

    async getMe() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return null
      const raw = window.localStorage.getItem(ME_KEY)
      if (!raw) return null
      const parsed = ClaimResult.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    },

    async signOut() {
      window.localStorage.removeItem(ME_KEY)
      const { error } = await sb.auth.signOut()
      if (error) throw fromRpcError(error, newRequestId())
    },

    async claimLoginCode(code) {
      await ensureSession()
      return remember(await rpc('claim_login_code', { p_code: code }, ClaimResult))
    },
    listJoinRoster: (joinCode) => rpc('list_join_roster', { p_join_code: joinCode }, RosterSeat.array()),
    async claimRosterSeat(joinCode, memberId) {
      await ensureSession()
      return remember(await rpc('claim_roster_seat', { p_join_code: joinCode, p_member_id: memberId }, ClaimResult))
    },

    getMyClasses: () => rpc('get_my_classes', {}, MyClass.array()),
    getClassOutline: (classId) => rpc('get_class_outline', { p_class_id: classId }, ClassOutline),
    nextActivity: (classId) => rpc('next_activity', { p_class_id: classId }, NextActivity),
    getActivity: (activityId) => rpc('get_activity', { p_activity_id: activityId }, Activity),
    submitAnswer: (activityId, response) =>
      rpc('submit_answer', { p_activity_id: activityId, p_response: response }, SubmitResult),
    getAssessment: (assessmentId) => rpc('get_assessment', { p_assessment_id: assessmentId }, Assessment),
    submitAssessment: (assessmentId, responses) =>
      rpc('submit_assessment', { p_assessment_id: assessmentId, p_responses: responses }, AssessmentResult),
    async heartbeat(activityId, seconds) {
      await rpc('heartbeat', { p_activity_id: activityId, p_seconds: seconds }, z.unknown())
    },
    getMyProgress: (classId) => rpc('get_my_progress', { p_class_id: classId }, MyProgress),

    listOpenModules: () => rpc('list_open_modules', {}, OpenModule.array()),
    getOpenActivity: (activityId) => rpc('get_activity', { p_activity_id: activityId }, Activity),
    selfRegister: (displayName) =>
      postFunction('/api/self-register', { display_name: displayName }, SelfRegisterResult, false),
    importGuestProgress: (payload) => rpc('import_guest_progress', { p_payload: payload }, ImportResult),

    requestHint: (activityId, response) =>
      postFunction('/api/hint', { activity_id: activityId, response }, HintResult, true),
  }
}
