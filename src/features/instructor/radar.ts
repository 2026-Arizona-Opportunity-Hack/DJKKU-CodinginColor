import { z } from 'zod'

/** Student-safe question content as stored in an activity (no answer key). */
export const RadarQuestion = z.object({
  id: z.string(),
  type: z.string(),
  prompt: z.string(),
  choices: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  items: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
})
export type RadarQuestion = z.infer<typeof RadarQuestion>

export const RadarRow = z.object({
  activity_id: z.string(),
  activity_title: z.string(),
  lesson_title: z.string(),
  question: RadarQuestion.nullable(),
  answered: z.number(),
  wrong: z.number(),
  answers: z.array(z.object({ answer: z.record(z.string(), z.unknown()), students: z.number() })).nullable(),
})
export type RadarRow = z.infer<typeof RadarRow>

/** A wrong answer in words: the choice text, what was typed, the blanks, or the order of lines. */
export function describeAnswer(question: RadarQuestion | null, answer: Record<string, unknown>): string {
  if (typeof answer.choice_id === 'string') {
    const text = question?.choices?.find((c) => c.id === answer.choice_id)?.text
    return text ? `chose "${text}"` : 'chose another option'
  }
  if (typeof answer.text === 'string') return `typed "${answer.text}"`
  if (Array.isArray(answer.blanks)) return `filled in ${answer.blanks.map((b) => `"${String(b)}"`).join(', ')}`
  if (Array.isArray(answer.order)) {
    const text = (id: unknown) => question?.items?.find((i) => i.id === id)?.text.trim() ?? String(id)
    return `put the lines in this order: ${answer.order.map(text).join(' / ')}`
  }
  return 'gave another answer'
}

/** "7 of 10 students (70%)" */
export function share(wrong: number, answered: number): string {
  return `${wrong} of ${answered} students (${answered ? Math.round((wrong / answered) * 100) : 0}%)`
}
