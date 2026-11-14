/**
 * Form values <-> contract responses for every question type (B8). Pure functions,
 * tested directly. Form fields are keyed `q0, q1, ...` (not by question id) so ids
 * can't collide with react-hook-form's path syntax.
 */
import { z } from 'zod'

import { REFLECTION_MAX, SHORT_ANSWER_MAX, blankCount, type Question, type QuestionResponse } from './content'

export type FieldValue = string | string[]
export type FormValues = Record<string, FieldValue>

export const fieldName = (index: number) => `q${index}`

export function fieldSchema(q: Question): z.ZodType<FieldValue, z.ZodTypeDef, FieldValue> {
  switch (q.type) {
    case 'mcq':
      return z.string().min(1, 'Choose an answer.')
    case 'short_answer':
      return z.string().trim().min(1, 'Write an answer.').max(SHORT_ANSWER_MAX, `Use ${SHORT_ANSWER_MAX} characters or fewer.`)
    case 'reflection':
      return z.string().trim().min(1, 'Write a few words.').max(REFLECTION_MAX, `Use ${REFLECTION_MAX} characters or fewer.`)
    case 'fill_blank':
      return z.array(z.string().trim().min(1, 'Fill in this blank.')).length(blankCount(q))
    case 'ordering':
      return z.array(z.string()).length(q.items.length)
  }
}

export function formSchema(questions: Question[]) {
  return z.object(Object.fromEntries(questions.map((q, i) => [fieldName(i), fieldSchema(q)])))
}

export function defaultValue(q: Question): FieldValue {
  switch (q.type) {
    case 'fill_blank':
      return Array.from({ length: blankCount(q) }, () => '')
    case 'ordering':
      return q.items.map((item) => item.id)
    default:
      return ''
  }
}

export function defaultValues(questions: Question[]): FormValues {
  return Object.fromEntries(questions.map((q, i) => [fieldName(i), defaultValue(q)]))
}

const asString = (v: FieldValue | undefined) => (typeof v === 'string' ? v : '')
const asArray = (v: FieldValue | undefined) => (Array.isArray(v) ? v : [])

export function toResponse(q: Question, value: FieldValue | undefined): QuestionResponse {
  switch (q.type) {
    case 'mcq':
      return { choice_id: asString(value) }
    case 'short_answer':
    case 'reflection':
      return { text: asString(value).trim() }
    case 'fill_blank':
      return { blanks: asArray(value).map((s) => s.trim()) }
    case 'ordering':
      return { order: [...asArray(value)] }
  }
}

/** One response per question, keyed by question id (what check, exit, worksheet and tests send). */
export function toResponses(questions: Question[], values: FormValues): Record<string, QuestionResponse> {
  return Object.fromEntries(questions.map((q, i) => [q.id, toResponse(q, values[fieldName(i)])]))
}

/** Move one item in a list; out-of-range moves return the list unchanged. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}
