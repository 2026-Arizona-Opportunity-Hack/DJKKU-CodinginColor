import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { SessionError, toSessionError } from '@/lib/session'
import type { ReportInput } from './report'

// Loads everything the student page needs for ONE student in ONE class. Every read goes through
// row-level security: only that class's instructors, a CIC admin, or the student's mentor get rows.
// Nothing here writes, except the two actions at the bottom (database functions that check the
// caller's role themselves).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const num = z.coerce.number()
const nullableNum = z.coerce.number().nullable()

const MemberRow = z.object({ id: z.string(), display_name: z.string(), profile_id: z.string().nullable(), claimed_at: z.string().nullable() })
const ClassRow = z.object({ name: z.string(), term: z.string().nullable() })
const ConceptRow = z.object({ id: z.string(), name: z.string() })
const ActivityRow = z.object({
  id: z.string(), position: num, kind: z.enum(['video', 'reading', 'check', 'worksheet', 'exit']), title: z.string(),
  required: z.boolean(), concept_id: z.string().nullable(), content: z.unknown(),
})
const ClassModuleRow = z.object({
  position: num,
  modules: z.object({
    id: z.string(),
    title: z.string(),
    lessons: z.array(z.object({ id: z.string(), position: num, title: z.string(), activities: z.array(ActivityRow) })),
    assessments: z.array(z.object({
      id: z.string(), kind: z.enum(['pre', 'post']), title: z.string(),
      assessment_items: z.array(z.object({ id: z.string(), position: num, pair_key: z.string(), concept_id: z.string(), content: z.unknown() })),
    })),
  }).nullable(),
})
const ClassCompletionRow = z.object({ student_id: z.string().nullable(), completion_pct: num, joined: z.boolean() })
const MasteryRow = z.object({ student_id: z.string(), concept_id: z.string(), attempts: num, mastery_pct: num })
const ClassTimeRow = z.object({ student_id: z.string(), activity_id: z.string(), time_spent_s: num })
const ProgressRow = z.object({
  activity_id: z.string(), status: z.enum(['in_progress', 'completed']), best_score: num, time_spent_s: num,
  started_at: z.string(), updated_at: z.string(), completed_at: z.string().nullable(),
})
const SubmissionRow = z.object({
  activity_id: z.string(), response: z.unknown(), is_correct: z.boolean().nullable(),
  results: z.unknown(),
  attempt_no: num, submitted_at: z.string(),
})
const Results = z.record(z.string(), z.object({ correct: z.boolean().optional(), concept: z.string().nullable().optional() }))
/** Per-question grading, `{question_id: {correct, concept}}`. Anything unreadable counts as no detail. */
const gradingOf = (raw: unknown): Record<string, { correct?: boolean; concept?: string | null }> => {
  const parsed = Results.safeParse(raw)
  return parsed.success ? parsed.data : {}
}
const ResultRow = z.object({ assessment_id: z.string(), score_pct: num, submitted_at: z.string() })
const ResponseRow = z.object({ assessment_item_id: z.string(), is_correct: z.boolean() })
const HintRow = z.object({ activity_id: z.string(), concept_id: z.string().nullable(), created_at: z.string() })
const GainRow = z.object({
  scope: z.enum(['student', 'class']), student_id: z.string().nullable(), module_id: z.string(), concept_id: z.string().nullable(),
  pre_pct: nullableNum, post_pct: nullableNum, gain_points: nullableNum, normalized_gain: nullableNum, status: z.enum(['complete', 'incomplete']),
})
const StuckRow = z.object({
  activity_id: z.string().nullable(), wrong_attempts: num, minutes_on_activity: num, days_inactive: num, reasons: z.array(z.string()),
})

const UNEXPECTED = 'The server sent something unexpected. Try again.'

async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await query
  if (error) throw toSessionError(error)
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new SessionError(UNEXPECTED, 'other', parsed.error)
  return parsed.data
}

export interface LoadedStudent {
  input: ReportInput
  memberId: string
  profileId: string | null
}

/**
 * `studentKey` is either the roster seat id (class_members.id) or the student's profile id, so the
 * page can be linked from the roster (seat) and from the stuck list (profile).
 */
export async function loadStudent(classId: string, studentKey: string, now = new Date()): Promise<LoadedStudent> {
  if (!UUID.test(classId) || !UUID.test(studentKey)) throw new SessionError('That student was not found in this class.', 'not_found')
  const sb = getSupabase()

  const members = await rows(
    sb.from('class_members').select('id, display_name, profile_id, claimed_at')
      .eq('class_id', classId).eq('member_role', 'student')
      .or(`id.eq.${studentKey},profile_id.eq.${studentKey}`).limit(1),
    z.array(MemberRow),
  )
  const member = members[0]
  if (!member) throw new SessionError('That student was not found in this class.', 'not_found')
  const sid = member.profile_id

  const [cls, concepts, classModules, classCompletion, mastery, classTimes] = await Promise.all([
    rows(sb.from('classes').select('name, term').eq('id', classId).maybeSingle(), ClassRow.nullable()),
    rows(sb.from('concepts').select('id, name'), z.array(ConceptRow)),
    rows(
      sb.from('class_modules')
        .select('position, modules(id, title, lessons(id, position, title, activities(id, position, kind, title, required, concept_id, content)), assessments(id, kind, title, assessment_items(id, position, pair_key, concept_id, content)))')
        .eq('class_id', classId).order('position'),
      z.array(ClassModuleRow),
    ),
    rows(sb.from('v_class_progress').select('student_id, completion_pct, joined').eq('class_id', classId), z.array(ClassCompletionRow)),
    rows(sb.from('v_concept_mastery').select('student_id, concept_id, attempts, mastery_pct').eq('class_id', classId), z.array(MasteryRow)),
    rows(sb.from('progress').select('student_id, activity_id, time_spent_s').eq('class_id', classId), z.array(ClassTimeRow)),
  ])

  const empty = { progress: [], submissions: [], results: [], responses: [], hints: [], gainMine: [], gainClass: [], stuck: [] }
  const mine = sid
    ? await Promise.all([
        rows(sb.from('progress').select('activity_id, status, best_score, time_spent_s, started_at, updated_at, completed_at').eq('class_id', classId).eq('student_id', sid), z.array(ProgressRow)),
        rows(sb.from('submissions').select('activity_id, response, is_correct, results, attempt_no, submitted_at').eq('class_id', classId).eq('student_id', sid).order('submitted_at'), z.array(SubmissionRow)),
        rows(sb.from('assessment_results').select('assessment_id, score_pct, submitted_at').eq('class_id', classId).eq('student_id', sid), z.array(ResultRow)),
        rows(sb.from('assessment_responses').select('assessment_item_id, is_correct').eq('class_id', classId).eq('student_id', sid), z.array(ResponseRow)),
        rows(sb.from('hint_events').select('activity_id, concept_id, created_at').eq('class_id', classId).eq('student_id', sid), z.array(HintRow)),
        rows(sb.from('v_learning_gain').select('scope, student_id, module_id, concept_id, pre_pct, post_pct, gain_points, normalized_gain, status').eq('class_id', classId).eq('scope', 'student').eq('student_id', sid), z.array(GainRow)),
        rows(sb.from('v_learning_gain').select('scope, student_id, module_id, concept_id, pre_pct, post_pct, gain_points, normalized_gain, status').eq('class_id', classId).eq('scope', 'class'), z.array(GainRow)),
        rows(sb.from('v_stuck').select('activity_id, wrong_attempts, minutes_on_activity, days_inactive, reasons').eq('class_id', classId).eq('student_id', sid), z.array(StuckRow)),
      ]).then(([progress, submissions, results, responses, hints, gainMine, gainClass, stuck]) => ({ progress, submissions, results, responses, hints, gainMine, gainClass, stuck }))
    : empty

  const input: ReportInput = {
    now,
    className: cls ? (cls.term ? `${cls.name} (${cls.term})` : cls.name) : 'This class',
    member: { id: member.id, displayName: member.display_name, profileId: sid, claimedAt: member.claimed_at },
    concepts,
    modules: classModules
      .filter((cm) => cm.modules !== null)
      .map((cm) => {
        const m = cm.modules!
        return {
          id: m.id,
          title: m.title,
          position: cm.position,
          lessons: [...m.lessons].sort((a, b) => a.position - b.position).map((l) => ({
            id: l.id, position: l.position, title: l.title,
            activities: [...l.activities].sort((a, b) => a.position - b.position).map((a) => ({
              id: a.id, position: a.position, kind: a.kind, title: a.title, required: a.required, conceptId: a.concept_id, content: a.content,
            })),
          })),
          tests: m.assessments.map((t) => ({
            id: t.id, kind: t.kind, title: t.title,
            items: t.assessment_items.map((i) => ({ id: i.id, position: i.position, pairKey: i.pair_key, conceptId: i.concept_id, content: i.content })),
          })),
        }
      }),
    progress: mine.progress.map((p) => ({ activityId: p.activity_id, status: p.status, bestScore: p.best_score, timeSpentS: p.time_spent_s, startedAt: p.started_at, updatedAt: p.updated_at, completedAt: p.completed_at })),
    classProgress: classTimes.map((p) => ({ studentId: p.student_id, activityId: p.activity_id, timeSpentS: p.time_spent_s })),
    submissions: mine.submissions.map((s) => ({ activityId: s.activity_id, response: s.response, isCorrect: s.is_correct, results: gradingOf(s.results), attemptNo: s.attempt_no, submittedAt: s.submitted_at })),
    testResults: mine.results.map((r) => ({ assessmentId: r.assessment_id, scorePct: r.score_pct, submittedAt: r.submitted_at })),
    testResponses: mine.responses.map((r) => ({ itemId: r.assessment_item_id, isCorrect: r.is_correct })),
    hints: mine.hints.map((h) => ({ activityId: h.activity_id, conceptId: h.concept_id, createdAt: h.created_at })),
    mastery: mastery.map((m) => ({ studentId: m.student_id, conceptId: m.concept_id, attempts: m.attempts, masteryPct: m.mastery_pct })),
    gain: [...mine.gainMine, ...mine.gainClass].map((g) => ({
      scope: g.scope, studentId: g.student_id, moduleId: g.module_id, conceptId: g.concept_id,
      prePct: g.pre_pct, postPct: g.post_pct, gainPoints: g.gain_points, normalizedGain: g.normalized_gain, status: g.status,
    })),
    stuck: mine.stuck.map((s) => ({ activityId: s.activity_id, wrongAttempts: s.wrong_attempts, minutesOnActivity: s.minutes_on_activity, daysInactive: s.days_inactive, reasons: s.reasons })),
    classCompletion: classCompletion.map((c) => ({ studentId: c.student_id, completionPct: c.completion_pct, joined: c.joined })),
  }
  return { input, memberId: member.id, profileId: sid }
}

// ---------- actions ----------

/** A new login code for this seat, shown once. Claiming it on a new device moves the student's data. */
export async function resetLoginCode(memberId: string): Promise<string> {
  const result = await rows(getSupabase().rpc('reset_login_code', { p_member_id: memberId }), z.object({ login_code: z.string() }))
  return result.login_code
}

/** Lets the student take one test again (the old result is removed). */
export async function allowRetake(studentId: string, classId: string, assessmentId: string): Promise<void> {
  const { error } = await getSupabase().rpc('reset_assessment_result', { p_student_id: studentId, p_class_id: classId, p_assessment_id: assessmentId })
  if (error) throw toSessionError(error)
}
