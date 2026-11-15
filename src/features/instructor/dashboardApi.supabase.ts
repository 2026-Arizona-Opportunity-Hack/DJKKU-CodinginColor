import { z } from 'zod'

import { getSupabase } from '@/lib/supabase'

const ClassProgressRow = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid().nullable(),
  display_name: z.string(),
  required_activities: z.number(),
  completed_activities: z.number(),
  completion_pct: z.coerce.number(),
  last_active_at: z.string().nullable(),
  joined: z.boolean(),
})

const NotStartedRow = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid().nullable(),
  display_name: z.string(),
  joined: z.boolean(),
})

const StuckRow = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid(),
  activity_id: z.string().uuid().nullable(),
  wrong_attempts: z.number(),
  minutes_on_activity: z.coerce.number(),
  hints_used: z.number(),
  days_inactive: z.number(),
  reasons: z.array(z.string()),
})

const ConceptMasteryRow = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid(),
  concept_id: z.string(),
  attempts: z.number(),
  correct_attempts: z.number(),
  mastery_pct: z.coerce.number(),
  last_attempt_at: z.string(),
})

const ReteachRow = z.object({
  class_id: z.string().uuid(),
  concept_id: z.string(),
  students: z.number(),
  attempts: z.number(),
  wrong_rate_pct: z.coerce.number(),
  hints_used: z.number(),
})

const LearningGainRow = z.object({
  scope: z.enum(['student', 'class']),
  class_id: z.string().uuid(),
  student_id: z.string().uuid().nullable(),
  module_id: z.string().uuid(),
  concept_id: z.string().nullable(),
  pre_pct: z.coerce.number().nullable(),
  post_pct: z.coerce.number().nullable(),
  gain_points: z.coerce.number().nullable(),
  normalized_gain: z.coerce.number().nullable(),
  status: z.enum(['complete', 'incomplete']),
  complete_count: z.number(),
  incomplete_count: z.number(),
})

/** A roster seat. An unclaimed seat has no profile yet, so it is linked by its seat id. */
const SeatRow = z.object({ id: z.string(), profile_id: z.string().nullable(), display_name: z.string() })

export interface InstructorDashboardData {
  progress: z.infer<typeof ClassProgressRow>[]
  /** Optional so older callers and test fixtures still type-check; the roster links unclaimed seats with it. */
  seats?: z.infer<typeof SeatRow>[]
  notStarted: z.infer<typeof NotStartedRow>[]
  stuck: z.infer<typeof StuckRow>[]
  mastery: z.infer<typeof ConceptMasteryRow>[]
  reteach: z.infer<typeof ReteachRow>[]
  learningGain: z.infer<typeof LearningGainRow>[]
}

export function isDashboardDatabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function loadInstructorDashboard(
  classId: string,
): Promise<InstructorDashboardData> {
  const supabase = getSupabase()

  const [
    progressResult,
    notStartedResult,
    stuckResult,
    masteryResult,
    reteachResult,
    gainResult,
    seatsResult,
  ] = await Promise.all([
    supabase.from('v_class_progress').select('*').eq('class_id', classId),
    supabase.from('v_not_started').select('*').eq('class_id', classId),
    supabase.from('v_stuck').select('*').eq('class_id', classId),
    supabase.from('v_concept_mastery').select('*').eq('class_id', classId),
    supabase.from('v_reteach').select('*').eq('class_id', classId),
    supabase
      .from('v_learning_gain')
      .select('*')
      .eq('class_id', classId)
      .eq('scope', 'class'),
    supabase.from('class_members').select('id, profile_id, display_name').eq('class_id', classId).eq('member_role', 'student'),
  ])

  const results = [
    progressResult,
    notStartedResult,
    stuckResult,
    masteryResult,
    reteachResult,
    gainResult,
    seatsResult,
  ]

  const failed = results.find((result) => result.error)

  if (failed?.error) {
    throw new Error(failed.error.message)
  }

  return {
    progress: ClassProgressRow.array().parse(progressResult.data),
    notStarted: NotStartedRow.array().parse(notStartedResult.data),
    stuck: StuckRow.array().parse(stuckResult.data),
    mastery: ConceptMasteryRow.array().parse(masteryResult.data),
    reteach: ReteachRow.array().parse(reteachResult.data),
    learningGain: LearningGainRow.array().parse(gainResult.data),
    seats: SeatRow.array().parse(seatsResult.data),
  }
}