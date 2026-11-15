import { describe, expect, it } from 'vitest'
import { CONCEPT_EXAMPLES, GRADES, RUBRIC, rubricPrompt } from './rubric'

describe('grade rubric', () => {
  it('has every grade from 1 to 12, each with every dimension filled in', () => {
    expect(GRADES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    for (const g of GRADES) {
      const r = RUBRIC[g]
      expect(r.grade).toBe(g)
      for (const field of ['vocabulary', 'sentences', 'conceptualizing', 'examples', 'technicalTerms', 'code', 'length', 'checkQuestion'] as const) {
        expect(r[field].length, `grade ${g} ${field}`).toBeGreaterThan(10)
      }
    }
  })

  it('puts grades in the K-12 CS Framework bands and lets explanations grow with the grade', () => {
    expect(GRADES.map((g) => RUBRIC[g].band)).toEqual(['K-2', 'K-2', '3-5', '3-5', '3-5', '6-8', '6-8', '6-8', '9-12', '9-12', '9-12', '9-12'])
    for (const g of GRADES.slice(1)) expect(RUBRIC[g].maxWords).toBeGreaterThan(RUBRIC[(g - 1) as typeof g].maxWords)
  })

  it('gives every concept an example for every band', () => {
    for (const bands of Object.values(CONCEPT_EXAMPLES)) expect(Object.keys(bands).sort()).toEqual(['3-5', '6-8', '9-12', 'K-2'])
  })

  it('turns a grade into instructions, with a concept example when the lesson matches one', () => {
    const young = rubricPrompt(1, 'Repeating with loops')
    expect(young).toContain('grade 1')
    expect(young).toContain('clapping 3 times')
    expect(young).toContain('Never more than 90 words')
    expect(rubricPrompt(12, 'Repeating with loops')).toContain('iterating over records')
    expect(rubricPrompt(5)).not.toContain('For this concept')
  })
})

describe('docs/grade-rubric.md', () => {
  it('matches the rubric in code', async () => {
    const { readFileSync } = await import('node:fs')
    const doc = readFileSync(new URL('../../docs/grade-rubric.md', import.meta.url), 'utf8')
    for (const g of GRADES) {
      expect(doc, `grade ${g} vocabulary`).toContain(RUBRIC[g].vocabulary.replace(/\|/g, '/'))
      expect(doc, `grade ${g} examples`).toContain(RUBRIC[g].examples.replace(/\|/g, '/'))
    }
  })
})
