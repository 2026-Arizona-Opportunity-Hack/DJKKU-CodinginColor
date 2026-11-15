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


import type { StudentApi } from './api'
import { ApiError, fromHttpStatus, fromRpcError, isOnline } from './errors'
import {
  Activity,
  CatchUp,
  Notes,
  SavedNote,
  Assessment,
  AssessmentResult,
  MeSchema,
  ClassOutline,
  HintResult,
  ImportResult,
  MyClass,
  MyProgress,
  NextActivity,
  OpenModule,
  SelfRegisterResult,
  SubmitResult,
} from './types'

const TIMEOUT_MS = 15_000

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

  /** A guest registering has no session yet: make an anonymous one first (the database function needs a user). */
  async function ensureAnonymousSession(): Promise<void> {
    const requestId = newRequestId()
    const { data } = await sb.auth.getSession()
    if (data.session) return
    const { error } = await sb.auth.signInAnonymously()
    if (!error) return
    const limited = (error as { status?: number }).status === 429 || String(error.code).includes('rate_limit')
    throw limited ? new ApiError('rate_limited', { requestId, status: 429, cause: error }) : fromRpcError(error, requestId)
  }

  return {
    source: 'supabase',

    async getMe() {
      const { data } = await sb.auth.getSession()
      if (!data.session) return null
      return rpc('get_me', {}, MeSchema.nullable())
    },

    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw fromRpcError(error, newRequestId())
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
    getCatchUp: (classId) => rpc('get_catch_up', { p_class_id: classId }, CatchUp),
    getMyNotes: () => rpc('get_my_notes', {}, Notes),
    saveNote: (activityId, body) => rpc('save_note', { p_activity_id: activityId, p_body: body }, SavedNote),

    listOpenModules: () => rpc('list_open_modules', {}, OpenModule.array()),
    getOpenActivity: (activityId) => rpc('get_activity', { p_activity_id: activityId }, Activity),
    async selfRegister(displayName) {
      await ensureAnonymousSession()
      return rpc('self_register', { p_display_name: displayName }, SelfRegisterResult)
    },
    importGuestProgress: (payload) => rpc('import_guest_progress', { p_payload: payload }, ImportResult),

    requestHint: (activityId, response) =>
      postFunction('/api/hint', { activity_id: activityId, response }, HintResult, true),
  }
}
