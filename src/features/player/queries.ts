/**
 * TanStack Query hooks for the student app: one place for cache keys, invalidation
 * and the B14 log events for mutations (each failure logged once, here).
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { log } from '@/lib/log'
import type { ActivityResponse, QuestionResponse } from '@/features/player/content'

import { useStudentApi } from './apiContext'
import { isApiError } from './errors'
import { clearGuestProgress, readGuestProgress } from './guestProgress'
import { getStore, safeGet, safeParse, safeRemove, safeSet } from './safeStorage'

export const keys = {
  me: ['me'] as const,
  classes: ['classes'] as const,
  outline: (classId: string) => ['outline', classId] as const,
  next: (classId: string) => ['next', classId] as const,
  activity: (id: string) => ['activity', id] as const,
  openActivity: (id: string) => ['openActivity', id] as const,
  assessment: (id: string) => ['assessment', id] as const,
  progress: (classId: string) => ['progress', classId] as const,
  roster: (joinCode: string) => ['roster', joinCode] as const,
  openModules: ['openModules'] as const,
}

/** Log a failure once with its request id and cause (never the payload). */
export function logFailure(event: string, error: unknown, ctx: Record<string, unknown> = {}): void {
  log.error(event, {
    ...ctx,
    errorCode: isApiError(error) ? error.code : 'unknown',
    requestId: isApiError(error) ? error.requestId : undefined,
    cause: isApiError(error) ? (error.cause ?? error) : error,
  })
}

export function useMe() {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.me, queryFn: () => api.getMe() })
}

export function useMyClasses() {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.classes, queryFn: () => api.getMyClasses() })
}

export function useOutline(classId: string) {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.outline(classId), queryFn: () => api.getClassOutline(classId) })
}

export function useNextActivity(classId: string | undefined) {
  const api = useStudentApi()
  return useQuery({
    queryKey: keys.next(classId ?? ''),
    queryFn: () => api.nextActivity(classId!),
    enabled: Boolean(classId),
  })
}

export function useActivity(activityId: string, guest = false) {
  const api = useStudentApi()
  return useQuery({
    queryKey: guest ? keys.openActivity(activityId) : keys.activity(activityId),
    queryFn: () => (guest ? api.getOpenActivity(activityId) : api.getActivity(activityId)),
  })
}

export function useAssessment(assessmentId: string) {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.assessment(assessmentId), queryFn: () => api.getAssessment(assessmentId) })
}

export function useMyProgress(classId: string) {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.progress(classId), queryFn: () => api.getMyProgress(classId) })
}

export function useOpenModules() {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.openModules, queryFn: () => api.listOpenModules() })
}

export function useJoinRoster(joinCode: string) {
  const api = useStudentApi()
  return useQuery({ queryKey: keys.roster(joinCode), queryFn: () => api.listJoinRoster(joinCode) })
}

/** After any claim, everything cached for the previous person is stale. */
function useOnSignedIn() {
  const qc = useQueryClient()
  return () => {
    qc.removeQueries()
    log.info('student.claim.ok')
  }
}

export function useClaimLoginCode() {
  const api = useStudentApi()
  const onSignedIn = useOnSignedIn()
  return useMutation({
    mutationFn: (code: string) => api.claimLoginCode(code),
    onSuccess: onSignedIn,
    onError: (e) => logFailure('student.claim.fail', e, { via: 'login_code' }),
  })
}

export function useClaimRosterSeat(joinCode: string) {
  const api = useStudentApi()
  const onSignedIn = useOnSignedIn()
  return useMutation({
    mutationFn: (memberId: string) => api.claimRosterSeat(joinCode, memberId),
    onSuccess: onSignedIn,
    onError: (e) => logFailure('student.claim.fail', e, { via: 'join_link' }),
  })
}

export function useSignOut() {
  const api = useStudentApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.signOut(),
    onSettled: () => qc.removeQueries(),
    onError: (e) => logFailure('student.signout.fail', e),
  })
}

export function useSubmitAnswer(activityId: string) {
  const api = useStudentApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (response: ActivityResponse) => api.submitAnswer(activityId, response),
    onSuccess: (result) => {
      log.info('student.submit.ok', { activityId, completed: result.completed })
      if (result.completed) {
        // Lock status and "next" changed on the server; refetch them.
        void qc.invalidateQueries({ queryKey: ['outline'] })
        void qc.invalidateQueries({ queryKey: ['next'] })
        void qc.invalidateQueries({ queryKey: ['progress'] })
        void qc.invalidateQueries({ queryKey: ['activity'] })
      }
    },
    onError: (e) => logFailure('student.submit.fail', e, { activityId }),
  })
}

export function useSubmitAssessment(assessmentId: string) {
  const api = useStudentApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (responses: Record<string, QuestionResponse>) => api.submitAssessment(assessmentId, responses),
    onSuccess: () => {
      log.info('student.assessment.ok', { assessmentId })
      void qc.invalidateQueries({ queryKey: ['outline'] })
      void qc.invalidateQueries({ queryKey: ['next'] })
      void qc.invalidateQueries({ queryKey: ['progress'] })
    },
    onError: (e) => logFailure('student.assessment.fail', e, { assessmentId }),
  })
}

export function useRequestHint(activityId: string) {
  const api = useStudentApi()
  return useMutation({
    mutationFn: (response: ActivityResponse) => api.requestHint(activityId, response),
    onError: (e) => logFailure('student.hint.fail', e, { activityId }),
  })
}

export type SavedAccount = { login_code: string; display_name: string; imported: number; importFailed: boolean }

/** A code the server issued but this device hasn't finished signing in with yet. */
export type IssuedCode = { login_code: string; display_name: string }
const ISSUED_KEY = 'cic.issued-code.v1'
const IssuedCodeSchema = z.object({ login_code: z.string().min(1), display_name: z.string() })

function readIssued(): IssuedCode | null {
  const parsed = IssuedCodeSchema.safeParse(safeParse(safeGet(ISSUED_KEY, getStore('session'))))
  return parsed.success ? parsed.data : null
}

/**
 * B4: guest → account. Register, sign this device in with the new code, then merge device
 * progress exactly once.
 * - The code is kept (state + sessionStorage) the moment selfRegister returns, and shown
 *   even if signing in fails. A retry signs in with that code; it never registers twice.
 * - If only the merge fails, the account still exists: show the code, keep device progress.
 */
export function useSaveGuestProgress() {
  const api = useStudentApi()
  const qc = useQueryClient()
  const [issued, setIssuedState] = useState<IssuedCode | null>(readIssued)
  const issuedRef = useRef(issued)
  const setIssued = (next: IssuedCode | null) => {
    issuedRef.current = next
    setIssuedState(next)
    const session = getStore('session')
    if (next) safeSet(ISSUED_KEY, JSON.stringify(next), session)
    else safeRemove(ISSUED_KEY, session)
  }

  const save = useMutation({
    mutationFn: async (displayName: string): Promise<SavedAccount> => {
      let code = issuedRef.current
      if (!code) {
        const { login_code } = await api.selfRegister(displayName)
        code = { login_code, display_name: displayName }
        setIssued(code)
      }
      const me = await api.claimLoginCode(code.login_code)
      log.info('student.claim.ok', { via: 'self_register' })
      setIssued(null)
      const { login_code } = code
      const payload = readGuestProgress()
      if (Object.keys(payload.completed).length === 0) {
        return { login_code, display_name: me.display_name, imported: 0, importFailed: false }
      }
      try {
        const { imported } = await api.importGuestProgress(payload)
        clearGuestProgress()
        log.info('student.guest.import.ok', { imported })
        return { login_code, display_name: me.display_name, imported, importFailed: false }
      } catch (e) {
        logFailure('student.guest.import.fail', e)
        return { login_code, display_name: me.display_name, imported: 0, importFailed: true }
      }
    },
    onSuccess: () => qc.removeQueries(),
    onError: (e) => logFailure('student.register.fail', e),
  })
  return { save, issued }
}
