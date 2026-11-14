/**
 * Content and response shapes for the student player.
 *
 * Question content comes from lane C (`@shared/authoring/schemas`), the single source
 * of truth. Lane C exports no schema for (a) the student view of an activity's content
 * or (b) what a student sends back, so lane B defines those two here. Both are listed
 * as gaps in docs/contracts/student-api.md.
 */
import { z } from 'zod'

import { BLANK, activityKind, questionContent, type ActivityKind, type QuestionContent } from '@shared/authoring/schemas'

export type Question = QuestionContent
export type QuestionType = Question['type']
export type { ActivityKind }

export const QUESTION_TYPES = ['mcq', 'short_answer', 'fill_blank', 'ordering', 'reflection'] as const satisfies readonly QuestionType[]
export const ACTIVITY_KINDS = activityKind.options

export const SHORT_ANSWER_MAX = 500
export const REFLECTION_MAX = 2000

/** Fill-in-the-blank questions mark each blank in the prompt with `___` (lane C). */
export function blankCount(q: Question): number {
  return q.type === 'fill_blank' ? q.prompt.split(BLANK).length - 1 : 0
}

export { BLANK }

// Student view of activity content: lane C's splitModule() field names, nested under `content`
// as the PROPOSED get_activity contract has it. (Gap: no exported schema in lane C.)
const QuestionsContent = z.object({ questions: z.array(questionContent).min(1) })
export const ActivityContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('video'), content: z.object({ embedUrl: z.string(), transcript: z.string().nullish() }) }),
  z.object({ kind: z.literal('reading'), content: z.object({ body: z.string() }) }),
  z.object({ kind: z.literal('check'), content: QuestionsContent }),
  z.object({ kind: z.literal('worksheet'), content: QuestionsContent }),
  z.object({ kind: z.literal('exit'), content: QuestionsContent }),
])
export type ActivityContent = z.infer<typeof ActivityContentSchema>

// Responses (what the student sends). Exactly one shape per question type. (Gap: lane C has none.)
export type McqResponse = { choice_id: string }
export type TextResponse = { text: string } // short_answer (≤500) and reflection (≤2000)
export type FillBlankResponse = { blanks: string[] }
export type OrderingResponse = { order: string[] }
export type QuestionResponse = McqResponse | TextResponse | FillBlankResponse | OrderingResponse

/** check, exit and worksheet all send every answer at once, keyed by question id. */
export type AnswersResponse = { answers: Record<string, QuestionResponse> }
/** Video and reading send an explicit "viewed" marker. */
export type ViewedResponse = { viewed: true }
export type ActivityResponse = AnswersResponse | ViewedResponse

/** "Loop: ___ i in ___(3)" -> "Loop: [blank 1] i in [blank 2](3)", so screen readers hear the blanks. */
export function labelBlanks(prompt: string): string {
  return prompt
    .split(BLANK)
    .map((part, i) => (i === 0 ? part : `[blank ${i}]${part}`))
    .join('')
}
