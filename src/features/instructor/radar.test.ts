import { describe, expect, it } from 'vitest'
import { describeAnswer, RadarRow, share } from './radar'

// Shape copied from get_class_misconceptions on the seed data.
const row = {
  wrong: 6, answered: 8,
  answers: [{ answer: { choice_id: 'c' }, students: 4 }, { answer: { choice_id: 'a' }, students: 2 }],
  question: { id: 'q-vars-1', type: 'mcq', prompt: 'After `x = 3` and then `x = x + 2`, what is x?', choices: [{ id: 'a', text: '3' }, { id: 'b', text: '5' }, { id: 'c', text: '32' }], conceptId: 'variables' },
  activity_id: '50000000-0000-4000-8000-000000000003', lesson_title: 'Variables', activity_title: 'Variables check',
}

describe('misconception radar', () => {
  it('parses what the database returns', () => {
    expect(RadarRow.parse(row).answers?.[0]?.students).toBe(4)
  })

  it('describes each kind of wrong answer in words', () => {
    const q = RadarRow.parse(row).question
    expect(describeAnswer(q, { choice_id: 'c' })).toBe('chose "32"')
    expect(describeAnswer(null, { text: 'for' })).toBe('typed "for"')
    expect(describeAnswer(null, { blanks: ['for', 'list'] })).toBe('filled in "for", "list"')
    const lines = { id: 'o', type: 'ordering', prompt: 'p', items: [{ id: 'l1', text: 'i = 0' }, { id: 'l2', text: '    print(i)' }] }
    expect(describeAnswer(lines, { order: ['l2', 'l1'] })).toBe('put the lines in this order: print(i) / i = 0')
  })

  it('gives a count and a percent', () => {
    expect(share(6, 8)).toBe('6 of 8 students (75%)')
    expect(share(0, 0)).toBe('0 of 0 students (0%)')
  })
})
