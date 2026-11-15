// Pure helpers for the hint function: which question the student got wrong, a stable form of their
// answer (for the cache key), and a readable form of it (for the model). Same rules as the database's
// grade_question and norm_text. No React, DOM or Workers-only APIs.
import { questionKey, questionContent, type QuestionContent, type QuestionKey } from '../authoring/schemas'

export type StudentResponse = Record<string, unknown>

/** Trim, collapse white space, and lower-case unless the question is case sensitive (norm_text in SQL). */
export const norm = (s: unknown, caseSensitive = false): string => {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ')
  return caseSensitive ? t : t.toLowerCase()
}

/** Was this one answer right? Mirrors grade_question. */
export function isCorrect(q: QuestionContent, key: QuestionKey, r: unknown): boolean {
  if (!r || typeof r !== 'object' || q.type === 'reflection') return false
  const o = r as Record<string, unknown>
  const cs = 'caseSensitive' in key ? key.caseSensitive : false
  if (key.type === 'mcq') return typeof o.choice_id === 'string' && o.choice_id === key.correctChoiceId
  if (key.type === 'short_answer') return typeof o.text === 'string' && key.accepted.some((a) => norm(a, cs) === norm(o.text, cs))
  if (key.type === 'fill_blank') {
    const blanks = o.blanks
    return Array.isArray(blanks) && blanks.length === key.blanks.length && key.blanks.every((accepted, i) => accepted.some((a) => norm(a, cs) === norm(blanks[i], cs)))
  }
  return Array.isArray(o.order) && o.order.length === key.correctOrder.length && o.order.every((x, i) => x === key.correctOrder[i])
}

export interface Target {
  question: QuestionContent
  key: QuestionKey
  answer: unknown
}

/** The first scored question the student got wrong (or left out); else the first scored question. */
export function pickQuestion(questions: unknown, keys: { question_id: string; key: unknown }[], response: StudentResponse): Target | null {
  const parsed = questionContent.array().safeParse(questions)
  if (!parsed.success) return null
  const answers = (response.answers && typeof response.answers === 'object' ? response.answers : {}) as Record<string, unknown>
  const scored: Target[] = []
  for (const q of parsed.data) {
    const k = questionKey.safeParse(keys.find((x) => x.question_id === q.id)?.key)
    if (q.type !== 'reflection' && k.success) scored.push({ question: q, key: k.data, answer: answers[q.id] })
  }
  return scored.find((t) => !isCorrect(t.question, t.key, t.answer)) ?? scored[0] ?? null
}

/** A stable string for the answer, so the same wrong answer always hits the same cache row. */
export function normalizedAnswer(t: Target): string {
  const a = (t.answer && typeof t.answer === 'object' ? t.answer : {}) as Record<string, unknown>
  const cs = 'caseSensitive' in t.key ? t.key.caseSensitive : false
  if (t.question.type === 'mcq') return `choice:${String(a.choice_id ?? '')}`
  if (t.question.type === 'ordering') return `order:${Array.isArray(a.order) ? a.order.join(',') : ''}`
  if (t.question.type === 'fill_blank') return `blanks:${Array.isArray(a.blanks) ? a.blanks.map((b) => norm(b, cs)).join('|') : ''}`
  return `text:${norm(a.text, cs)}`
}

/** The student's answer in words, for the model. Never includes an id that identifies a person. */
export function readableAnswer(t: Target): string {
  const a = (t.answer && typeof t.answer === 'object' ? t.answer : {}) as Record<string, unknown>
  const q = t.question
  if (q.type === 'mcq') return q.choices.find((c) => c.id === a.choice_id)?.text ?? '(no choice)'
  if (q.type === 'ordering') {
    const byId = new Map(q.items.map((i) => [i.id, i.text]))
    return Array.isArray(a.order) ? a.order.map((id) => byId.get(String(id)) ?? '?').join(' then ') : '(no order)'
  }
  if (q.type === 'fill_blank') return Array.isArray(a.blanks) ? a.blanks.map((b, i) => `blank ${i + 1}: ${String(b)}`).join('; ') : '(no answer)'
  return String(a.text ?? '(no answer)')
}

/** Every string that counts as giving the answer away. */
export function answerStrings(t: Target): string[] {
  const { question: q, key: k } = t
  const out: string[] = []
  if (k.type === 'mcq' && q.type === 'mcq') out.push(q.choices.find((c) => c.id === k.correctChoiceId)?.text ?? '')
  if (k.type === 'short_answer') out.push(...k.accepted)
  if (k.type === 'fill_blank') out.push(...k.blanks.flat())
  if (k.type === 'ordering' && q.type === 'ordering') {
    const byId = new Map(q.items.map((i) => [i.id, i.text]))
    out.push(k.correctOrder.map((id) => byId.get(id) ?? '').join(' '))
  }
  return out.map((s) => s.trim()).filter(Boolean)
}

const words = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `

/** True when the model's text contains any correct answer, as whole words, ignoring case and punctuation. */
export function revealsAnswer(output: string, t: Target): boolean {
  const o = words(output)
  return answerStrings(t).some((s) => o.includes(words(s)))
}
