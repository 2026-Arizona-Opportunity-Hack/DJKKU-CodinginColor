/**
 * TanStack Query hooks for the student app: one place for cache keys, invalidation
 * and the B14 log events for mutations (each failure logged once, here).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { log } from '@/lib/log'
import type { ActivityResponse, QuestionResponse } from '@/shared/content'

import { useStudentApi } from './apiContext'
import { isApiError } from './errors'
import { clearGuestProgress, readGuestProgress } from './guestProgress'

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

/**
 * B4: guest → account. Register, sign this device in with the new code, then merge device
 * progress exactly once. If only the merge fails, the account still exists: we show the code
 * and keep the device progress so nothing is lost.
 */
export function useSaveGuestProgress() {
  const api = useStudentApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string): Promise<SavedAccount> => {
      const { login_code } = await api.selfRegister(displayName)
      const me = await api.claimLoginCode(login_code)
      log.info('student.claim.ok', { via: 'self_register' })
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
}
