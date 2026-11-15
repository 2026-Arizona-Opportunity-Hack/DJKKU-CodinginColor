import { describe, expect, it } from 'vitest'
import type { QuestionContent } from '../authoring/schemas'
import { isCorrect, normalizedAnswer, pickQuestion, readableAnswer, revealsAnswer } from './grade'

const mcq = { type: 'mcq', id: 'q1', prompt: 'P', conceptId: 'loops', choices: [{ id: 'a', text: 'A loop' }, { id: 'b', text: 'A variable' }] } as QuestionContent
const short = { type: 'short_answer', id: 'q2', prompt: 'Keyword?', conceptId: 'loops' } as QuestionContent
const fill = { type: 'fill_blank', id: 'q3', prompt: 'A ___ and an ___', conceptId: 'loops' } as QuestionContent
const order = { type: 'ordering', id: 'q4', prompt: 'Order', conceptId: 'loops', items: [{ id: 'i2', text: 'Second' }, { id: 'i1', text: 'First' }] } as QuestionContent
const reflect = { type: 'reflection', id: 'q5', prompt: 'Why?' } as QuestionContent
const keys = [
  { question_id: 'q1', key: { type: 'mcq', correctChoiceId: 'a', hints: [] } },
  { question_id: 'q2', key: { type: 'short_answer', accepted: ['while'], caseSensitive: false, hints: [] } },
  { question_id: 'q3', key: { type: 'fill_blank', blanks: [['loop', 'for'], ['if']], caseSensitive: false, hints: [] } },
  { question_id: 'q4', key: { type: 'ordering', correctOrder: ['i1', 'i2'], hints: [] } },
]

describe('isCorrect (same rules as grade_question)', () => {
  const k = (id: string) => keys.find((x) => x.question_id === id)!.key as never
  it('grades each type', () => {
    expect(isCorrect(mcq, k('q1'), { choice_id: 'a' })).toBe(true)
    expect(isCorrect(mcq, k('q1'), { choice_id: 'b' })).toBe(false)
    expect(isCorrect(short, k('q2'), { text: '  WHILE ' })).toBe(true)
    expect(isCorrect(short, k('q2'), { text: 'until' })).toBe(false)
    expect(isCorrect(fill, k('q3'), { blanks: ['For', 'IF'] })).toBe(true)
    expect(isCorrect(fill, k('q3'), { blanks: ['for'] })).toBe(false)
    expect(isCorrect(order, k('q4'), { order: ['i1', 'i2'] })).toBe(true)
    expect(isCorrect(order, k('q4'), { order: ['i2', 'i1'] })).toBe(false)
  })
  it('treats missing or malformed answers as wrong', () => {
    expect(isCorrect(mcq, k('q1'), undefined)).toBe(false)
    expect(isCorrect(mcq, k('q1'), 'a')).toBe(false)
  })
})

describe('pickQuestion', () => {
  const all = [mcq, short, fill, order, reflect]
  it('picks the first wrong scored question and skips reflections', () => {
    const t = pickQuestion(all, keys, { answers: { q1: { choice_id: 'a' }, q2: { text: 'until' } } })!
    expect(t.question.id).toBe('q2')
  })
  it('falls back to the first scored question when everything is right, and to null when nothing is scored', () => {
    expect(pickQuestion([mcq], keys, { answers: { q1: { choice_id: 'a' } } })!.question.id).toBe('q1')
    expect(pickQuestion([reflect], keys, {})).toBeNull()
    expect(pickQuestion('garbage', keys, {})).toBeNull()
  })
})

describe('normalizedAnswer and readableAnswer', () => {
  it('gives the same string for the same wrong answer, however it is typed', () => {
    const a = pickQuestion([short], keys, { answers: { q2: { text: 'Until ' } } })!
    const b = pickQuestion([short], keys, { answers: { q2: { text: 'until' } } })!
    expect(normalizedAnswer(a)).toBe(normalizedAnswer(b))
  })
  it('describes an answer in words, not ids', () => {
    expect(readableAnswer(pickQuestion([mcq], keys, { answers: { q1: { choice_id: 'b' } } })!)).toBe('A variable')
    expect(readableAnswer(pickQuestion([order], keys, { answers: { q4: { order: ['i2', 'i1'] } } })!)).toBe('Second then First')
  })
})

describe('revealsAnswer', () => {
  const t = pickQuestion([mcq, short, fill], keys, { answers: { q1: { choice_id: 'b' } } })!
  it('catches the answer as whole words, ignoring case and punctuation', () => {
    expect(revealsAnswer('It is a loop!', t)).toBe(true)
    expect(revealsAnswer('Think about what repeats.', t)).toBe(false)
    expect(revealsAnswer('A loops-based idea', t)).toBe(false) // "loops" is not "loop"
  })
  it('checks every accepted answer and every blank', () => {
    const s = pickQuestion([short], keys, { answers: { q2: { text: 'x' } } })!
    expect(revealsAnswer('Use the keyword while here', s)).toBe(true)
    const f = pickQuestion([fill], keys, { answers: {} })!
    expect(revealsAnswer('The second blank is if', f)).toBe(true)
    expect(revealsAnswer('The second blank decides something', f)).toBe(false)
  })
})
