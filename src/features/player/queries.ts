/**
 * TanStack Query hooks for the student app: one place for cache keys, invalidation
 * and the B14 log events for mutations (each failure logged once, here).
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { log } from '@/lib/log'
import type { ActivityResponse, QuestionResponse } from '@/features/player/content'

import { useStudentApi } from './apiContext'
import { isApiError } from './errors'
import { clearGuestProgress, readGuestProgress, type GuestProgress } from './guestProgress'
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

/** A personal login code the server issued to this device's guest. */
export type IssuedCode = { login_code: string; display_name: string }
const ISSUED_KEY = 'cic.issued-code.v1'
const IssuedCodeSchema = z.object({ login_code: z.string().min(1), display_name: z.string() })

function readIssued(): IssuedCode | null {
  const parsed = IssuedCodeSchema.safeParse(safeParse(safeGet(ISSUED_KEY, getStore('session'))))
  return parsed.success ? parsed.data : null
}

/**
 * B4: guest → account. Registers a display name (this device is signed in as the new student),
 * merges the device's guest progress, and keeps the returned login code (state + sessionStorage)
 * so it survives a reload and a second click can't create a second account. The code is for
 * signing in on another device (/sign-in is the auth feature's page).
 */
export function useSaveGuestProgress() {
  const api = useStudentApi()
  const qc = useQueryClient()
  const [issued, setIssued] = useState<IssuedCode | null>(readIssued)
  const save = useMutation({
    mutationFn: async (displayName: string): Promise<IssuedCode> => {
      const { login_code } = await api.selfRegister(displayName)
      // This device is now signed in as the new student, so copy its guest progress over right away.
      // A failure must not hide the login code; the device copy stays and /learn retries the merge.
      const payload = readGuestProgress()
      if (Object.keys(payload.completed).length > 0) {
        try {
          await api.importGuestProgress(payload)
          clearGuestProgress()
        } catch (e) {
          logFailure('student.guest.import.fail', e)
        }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: keys.classes })])
      return { login_code, display_name: displayName }
    },
    onSuccess: (code) => {
      setIssued(code)
      safeSet(ISSUED_KEY, JSON.stringify(code), getStore('session'))
      log.info('student.register.ok')
    },
    onError: (e) => logFailure('student.register.fail', e),
  })
  return { save, issued }
}

/**
 * After a signed-in student lands on /learn, copy this device's guest progress to their
 * account once, then clear it from the device. A failure keeps the device copy.
 */
export function useImportGuestProgressOnce(enabled: boolean) {
  const api = useStudentApi()
  const qc = useQueryClient()
  const started = useRef(false)
  const merge = useMutation({
    mutationFn: (payload: GuestProgress) => api.importGuestProgress(payload),
    onSuccess: ({ imported }) => {
      clearGuestProgress()
      safeRemove(ISSUED_KEY, getStore('session'))
      log.info('student.guest.import.ok', { imported })
      void qc.invalidateQueries()
    },
    onError: (e) => logFailure('student.guest.import.fail', e),
  })
  useEffect(() => {
    if (!enabled || started.current) return
    const payload = readGuestProgress()
    if (Object.keys(payload.completed).length === 0) return
    started.current = true
    merge.mutate(payload)
  }, [enabled, merge])
  return merge
}
