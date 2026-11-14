/**
 * Shapes of what lane A's RPCs and lane E's Pages Functions return to the student app.
 * PROPOSED: docs/contracts/student-api.md is the human-readable copy. The Supabase
 * implementation parses every response with these schemas (trust boundary).
 */
import { z } from 'zod'

import { ActivityContentSchema, QuestionSchema } from '@/shared/content'

export const ItemStatus = z.enum(['locked', 'available', 'done'])
export type ItemStatus = z.infer<typeof ItemStatus>

export const ClaimResult = z.object({
  class_id: z.string(),
  class_name: z.string(),
  display_name: z.string(),
})
export type ClaimResult = z.infer<typeof ClaimResult>

export const RosterSeat = z.object({ member_id: z.string(), label: z.string() })
export type RosterSeat = z.infer<typeof RosterSeat>

export const MyClass = z.object({ class_id: z.string(), class_name: z.string(), kind: z.string() })
export type MyClass = z.infer<typeof MyClass>

const AssessmentRef = z.object({ assessment_id: z.string(), status: ItemStatus })
export type AssessmentRef = z.infer<typeof AssessmentRef>

export const OutlineActivity = z.object({
  activity_id: z.string(),
  title: z.string(),
  kind: z.enum(['video', 'reading', 'check', 'worksheet', 'exit']),
  position: z.number(),
  required: z.boolean(),
  status: ItemStatus,
  locked_reason: z.string().nullish(),
})
export type OutlineActivity = z.infer<typeof OutlineActivity>

export const OutlineLesson = z.object({
  lesson_id: z.string(),
  title: z.string(),
  position: z.number(),
  activities: z.array(OutlineActivity),
})
export type OutlineLesson = z.infer<typeof OutlineLesson>

export const OutlineModule = z.object({
  module_id: z.string(),
  title: z.string(),
  position: z.number(),
  pretest: AssessmentRef.nullable(),
  posttest: AssessmentRef.nullable(),
  lessons: z.array(OutlineLesson),
})
export type OutlineModule = z.infer<typeof OutlineModule>

export const ClassOutline = z.object({ modules: z.array(OutlineModule) })
export type ClassOutline = z.infer<typeof ClassOutline>

export const NextActivity = z
  .object({ module_id: z.string(), lesson_id: z.string(), activity_id: z.string() })
  .nullable()
export type NextActivity = z.infer<typeof NextActivity>

export const Activity = z.intersection(
  z.object({
    activity_id: z.string(),
    title: z.string(),
    status: ItemStatus,
    prev_id: z.string().nullish(),
    next_id: z.string().nullish(),
  }),
  ActivityContentSchema,
)
export type Activity = z.infer<typeof Activity>

export const SubmitResult = z.object({
  is_correct: z.boolean().nullable(),
  score: z.number(),
  feedback: z.string().nullish(),
  explanation: z.string().nullish(),
  completed: z.boolean(),
  next_activity_id: z.string().nullish(),
  module_completed: z.boolean(),
  unlocked_module_title: z.string().nullish(),
})
export type SubmitResult = z.infer<typeof SubmitResult>

export const Assessment = z.object({
  assessment_id: z.string(),
  kind: z.enum(['pre', 'post']),
  items: z.array(QuestionSchema),
  taken: z.boolean(),
})
export type Assessment = z.infer<typeof Assessment>

export const AssessmentResult = z.object({
  score_pct: z.number(),
  per_concept: z.array(z.object({ concept: z.string(), pct: z.number() })),
})
export type AssessmentResult = z.infer<typeof AssessmentResult>

export const MyProgress = z.object({
  completed: z.number(),
  total: z.number(),
  modules: z.array(
    z.object({
      title: z.string(),
      pct: z.number(),
      pre_pct: z.number().nullish(),
      post_pct: z.number().nullish(),
      gain: z.number().nullish(),
    }),
  ),
})
export type MyProgress = z.infer<typeof MyProgress>

export const OpenModule = z.object({
  module_id: z.string(),
  title: z.string(),
  summary: z.string().nullish(),
  lessons: z.array(
    z.object({
      lesson_id: z.string(),
      title: z.string(),
      activities: z.array(OutlineActivity.pick({ activity_id: true, title: true, kind: true })),
    }),
  ),
})
export type OpenModule = z.infer<typeof OpenModule>

export const ImportResult = z.object({ imported: z.number() })
export type ImportResult = z.infer<typeof ImportResult>

export const SelfRegisterResult = z.object({ login_code: z.string() })
export type SelfRegisterResult = z.infer<typeof SelfRegisterResult>

export const HintResult = z.object({
  hint: z.string(),
  source: z.enum(['ladder', 'ai', 'cache']),
  remaining: z.number().int().min(0),
})
export type HintResult = z.infer<typeof HintResult>
