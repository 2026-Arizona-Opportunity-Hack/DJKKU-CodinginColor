import { describe, expect, it } from 'vitest'

import { blankCount, labelBlanks, type Question } from '../content'
import { defaultValue, fieldSchema, move, toResponse, toResponses } from '../questionForm'
import { safeUrl } from '@/components/learning/safeUrl'

// Lane C question content shapes (shared/authoring/schemas.ts).
const mcq: Question = { id: 'q1', conceptId: 'c', type: 'mcq', prompt: 'p', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }
const short: Question = { id: 'q2', conceptId: 'c', type: 'short_answer', prompt: 'p' }
const reflection: Question = { id: 'q3', type: 'reflection', prompt: 'p' }
const fill: Question = { id: 'q4', conceptId: 'c', type: 'fill_blank', prompt: '___ i in ___(3):' }
const ordering: Question = { id: 'q5', conceptId: 'c', type: 'ordering', prompt: 'p', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }

describe('B8 response shapes per question type', () => {
  it.each([
    [mcq, 'b', { choice_id: 'b' }],
    [short, '  range ', { text: 'range' }],
    [reflection, 'It was hard', { text: 'It was hard' }],
    [fill, [' for', 'range '], { blanks: ['for', 'range'] }],
    [ordering, ['b', 'a'], { order: ['b', 'a'] }],
  ] as const)('%o builds the contract response', (question, value, expected) => {
    expect(toResponse(question, typeof value === 'string' ? value : [...value])).toEqual(expected)
  })

  it('keys responses by question id', () => {
    expect(toResponses([mcq, short], { q0: 'a', q1: 'x' })).toEqual({ q1: { choice_id: 'a' }, q2: { text: 'x' } })
  })

  it('validates: required answers, length caps, every blank', () => {
    expect(fieldSchema(mcq).safeParse('').success).toBe(false)
    expect(fieldSchema(short).safeParse('x'.repeat(501)).success).toBe(false)
    expect(fieldSchema(reflection).safeParse('x'.repeat(2000)).success).toBe(true)
    expect(fieldSchema(reflection).safeParse('   ').success).toBe(false)
    expect(fieldSchema(fill).safeParse(['for', '']).success).toBe(false)
  })

  it('counts blanks from lane C ___ markers and labels them for screen readers', () => {
    expect(blankCount(fill)).toBe(2)
    expect(labelBlanks('___ i in ___(3):')).toBe('[blank 1] i in [blank 2](3):')
    expect(defaultValue(fill)).toEqual(['', ''])
  })

  it('ordering starts in the order the server sent', () => {
    expect(defaultValue(ordering)).toEqual(['a', 'b'])
  })

  it('move() ignores out-of-range moves', () => {
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('reading links allow-list', () => {
  it.each([
    ['https://docs.python.org', 'https://docs.python.org'],
    ['mailto:help@example.org', 'mailto:help@example.org'],
    ['javascript:alert(1)', ''],
    ['data:text/html;base64,xx', ''],
    ['/relative', ''],
  ])('%s -> %s', (input, out) => expect(safeUrl(input)).toBe(out))
})
