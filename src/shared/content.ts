/**
 * Content shapes shared by the student player (lane B) and the authoring studio (lane C).
 * PROPOSED contract: see docs/contracts/student-api.md. Questions never carry answers;
 * grading happens on the server.
 */
import { z } from 'zod'

export const QUESTION_TYPES = ['mcq', 'short_answer', 'fill_blank', 'ordering', 'reflection'] as const
export const ACTIVITY_KINDS = ['video', 'reading', 'check', 'worksheet', 'exit'] as const

export const SHORT_ANSWER_MAX = 500
export const REFLECTION_MAX = 2000

const Option = z.object({ id: z.string().min(1), text: z.string() })

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  choices: z.array(Option).optional(),
  blanks: z.number().int().positive().optional(),
  items: z.array(Option).optional(),
})
export type Question = z.infer<typeof QuestionSchema>
export type QuestionType = Question['type']

/** YouTube ids are 11 chars of [A-Za-z0-9_-]; anything else is rejected before it reaches an iframe. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export const VideoContent = z.object({ youtube_id: z.string().regex(YOUTUBE_ID), transcript: z.string().optional() })
export const ReadingContent = z.object({ markdown: z.string() })
export const QuestionContent = z.object({ question: QuestionSchema })
export const WorksheetContent = z.object({ items: z.array(QuestionSchema).min(1) })

export const ActivityContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('video'), content: VideoContent }),
  z.object({ kind: z.literal('reading'), content: ReadingContent }),
  z.object({ kind: z.literal('check'), content: QuestionContent }),
  z.object({ kind: z.literal('exit'), content: QuestionContent }),
  z.object({ kind: z.literal('worksheet'), content: WorksheetContent }),
])
export type ActivityContent = z.infer<typeof ActivityContentSchema>
export type ActivityKind = ActivityContent['kind']

// Responses (what the student sends). Exactly one shape per question type.
export const McqResponse = z.object({ choice_id: z.string().min(1) })
export const ShortAnswerResponse = z.object({ text: z.string().max(SHORT_ANSWER_MAX) })
export const FillBlankResponse = z.object({ blanks: z.array(z.string()) })
export const OrderingResponse = z.object({ order: z.array(z.string()) })
export const ReflectionResponse = z.object({ text: z.string().max(REFLECTION_MAX) })

export type McqResponse = z.infer<typeof McqResponse>
export type ShortAnswerResponse = z.infer<typeof ShortAnswerResponse>
export type FillBlankResponse = z.infer<typeof FillBlankResponse>
export type OrderingResponse = z.infer<typeof OrderingResponse>
export type ReflectionResponse = z.infer<typeof ReflectionResponse>
export type QuestionResponse =
  | McqResponse
  | ShortAnswerResponse
  | FillBlankResponse
  | OrderingResponse
  | ReflectionResponse

/** Worksheets send every answer at once. */
export type WorksheetResponse = { answers: Record<string, QuestionResponse> }
/** Video and reading send an explicit "viewed" marker (PROPOSED addition, see contract doc). */
export type ViewedResponse = { viewed: true }
export type ActivityResponse = QuestionResponse | WorksheetResponse | ViewedResponse
