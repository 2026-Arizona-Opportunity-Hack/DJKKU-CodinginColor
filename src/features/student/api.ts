/**
 * StudentApi: everything the student app asks of the backend, in one interface.
 * Two implementations: api.supabase.ts (real RPCs and Pages Functions) and api.mock.ts
 * (in-memory, for demos and tests). The UI never imports either directly.
 * See docs/adr/0001-student-api-interface.md.
 */
import type { ActivityResponse, QuestionResponse } from '@/shared/content'

import type { GuestProgress } from './guestProgress'
import type {
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

/** Who is signed in on this device, cached from the last claim (no personal data beyond the label). */
export type Me = { display_name: string; class_id: string; class_name: string }

export interface StudentApi {
  readonly source: 'mock' | 'supabase'

  // Session
  getMe(): Promise<Me | null>
  signOut(): Promise<void>
  claimLoginCode(code: string): Promise<ClaimResult>
  listJoinRoster(joinCode: string): Promise<RosterSeat[]>
  claimRosterSeat(joinCode: string, memberId: string): Promise<ClaimResult>

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

  // Guest mode and self-register
  listOpenModules(): Promise<OpenModule[]>
  getOpenActivity(activityId: string): Promise<Activity>
  selfRegister(displayName: string): Promise<SelfRegisterResult>
  importGuestProgress(payload: GuestProgress): Promise<ImportResult>

  // Hints (feature-flagged)
  requestHint(activityId: string, response: ActivityResponse): Promise<HintResult>
}

/** Heartbeats are capped at 30 s each (contract). */
export const HEARTBEAT_SECONDS = 30
