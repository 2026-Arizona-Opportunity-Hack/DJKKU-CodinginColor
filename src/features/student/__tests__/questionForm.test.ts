import { describe, expect, it } from 'vitest'

import type { Question } from '@/shared/content'

import { defaultValue, fieldSchema, move, toResponse, toResponses } from '../questionForm'
import { safeUrl } from '../safeUrl'

const q = (type: Question['type'], extra: Partial<Question> = {}): Question => ({ id: `id-${type}`, type, prompt: 'p', ...extra })

describe('B8 response shapes per question type', () => {
  it.each([
    [q('mcq'), 'b', { choice_id: 'b' }],
    [q('short_answer'), '  range ', { text: 'range' }],
    [q('reflection'), 'It was hard', { text: 'It was hard' }],
    [q('fill_blank', { blanks: 2 }), [' for', 'range '], { blanks: ['for', 'range'] }],
    [q('ordering', { items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }), ['b', 'a'], { order: ['b', 'a'] }],
  ])('%o builds the contract response', (question, value, expected) => {
    expect(toResponse(question, value)).toEqual(expected)
  })

  it('worksheets key responses by question id', () => {
    const qs = [q('mcq'), q('short_answer')]
    expect(toResponses(qs, { q0: 'a', q1: 'x' })).toEqual({ 'id-mcq': { choice_id: 'a' }, 'id-short_answer': { text: 'x' } })
  })

  it('validates: required answers, length caps, every blank', () => {
    expect(fieldSchema(q('mcq')).safeParse('').success).toBe(false)
    expect(fieldSchema(q('short_answer')).safeParse('x'.repeat(501)).success).toBe(false)
    expect(fieldSchema(q('reflection')).safeParse('x'.repeat(2000)).success).toBe(true)
    expect(fieldSchema(q('reflection')).safeParse('   ').success).toBe(false)
    expect(fieldSchema(q('fill_blank', { blanks: 2 })).safeParse(['for', '']).success).toBe(false)
  })

  it('defaults: one empty string per blank; ordering starts in the given order', () => {
    expect(defaultValue(q('fill_blank', { blanks: 3 }))).toEqual(['', '', ''])
    expect(defaultValue(q('ordering', { items: [{ id: 'x', text: '' }, { id: 'y', text: '' }] }))).toEqual(['x', 'y'])
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
