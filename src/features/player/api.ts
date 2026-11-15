/**
 * StudentApi: everything the student app asks of the backend, in one interface.
 * Two implementations: api.supabase.ts (real RPCs and Pages Functions) and api.mock.ts
 * (in-memory, for demos and tests). The UI never imports either directly.
 * See docs/adr/0001-student-api-interface.md.
 */
import type { ActivityResponse, QuestionResponse } from '@/features/player/content'
import type { Me } from '@/lib/session'

import type { GuestProgress } from './guestProgress'
import type {
  Activity,
  CatchUp,
  Note,
  SavedNote,
  Assessment,
  AssessmentResult,
  ClassOutline,
  HintResult,
  SimplifyResult,
  ImportResult,
  MyClass,
  MyProgress,
  NextActivity,
  OpenModule,
  SelfRegisterResult,
  SubmitResult,
} from './types'

/** Who is signed in (the shape of get_me). Defined once in src/lib/session.ts. */
export type { Me }

export interface StudentApi {
  readonly source: 'mock' | 'supabase'

  // Session (signing in is the auth feature's job, at /sign-in)
  getMe(): Promise<Me | null>
  signOut(): Promise<void>

  // Learning
  getMyClasses(): Promise<MyClass[]>
  getClassOutline(classId: string): Promise<ClassOutline>
  nextActivity(classId: string): Promise<NextActivity>
  getActivity(activityId: string): Promise<Activity>
  submitAnswer(activityId: string, response: ActivityResponse): Promise<SubmitResult>
  getAssessment(assessmentId: string): Promise<Assessment>
  submitAssessment(assessmentId: string, responses: Record<string, QuestionResponse>): Promise<AssessmentResult>
  heartbeat(activityId: string, seconds: number): Promise<void>
  getMyProgress(classId: string): Promise<MyProgress>
  getCatchUp(classId: string): Promise<CatchUp>
  getMyNotes(): Promise<Note[]>
  saveNote(activityId: string, body: string): Promise<SavedNote>

  // Guest mode and self-register
  listOpenModules(): Promise<OpenModule[]>
  getOpenActivity(activityId: string): Promise<Activity>
  selfRegister(displayName: string): Promise<SelfRegisterResult>
  importGuestProgress(payload: GuestProgress): Promise<ImportResult>

  // Hints (feature-flagged)
  requestHint(activityId: string, response: ActivityResponse): Promise<HintResult>
  /** "Explain it for my grade" for a reading or video. Guests may use it on open lessons. */
  simplify(activityId: string, grade: number): Promise<SimplifyResult>
}

/** Heartbeats are capped at 30 s each (contract). */
export const HEARTBEAT_SECONDS = 30
