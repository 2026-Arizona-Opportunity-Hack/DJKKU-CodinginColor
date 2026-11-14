import { describe, expect, it } from 'vitest'
import { buildCompletion, buildLearningGain, cohortLabel } from './aggregate'
import type { ClassGainRow, ClassProgressRow } from './source'

function progress(over: Partial<ClassProgressRow>): ClassProgressRow {
  return {
    class_id: 'c1',
    class_name: 'Period 3',
    term: '2026 Fall',
    school_name: 'Maryvale',
    students: 10,
    avg_completion_pct: 50,
    ...over,
  }
}

function gain(over: Partial<ClassGainRow>): ClassGainRow {
  return {
    class_id: 'c1',
    class_name: 'Period 3',
    term: '2026 Fall',
    school_name: 'Maryvale',
    module_id: 'm1',
    module_title: 'Variables and Loops',
    concept_id: null,
    concept_name: null,
    pre_pct: 40,
    post_pct: 60,
    gain_points: 20,
    normalized_gain: 0.333,
    complete_count: 10,
    incomplete_count: 2,
    ...over,
  }
}

describe('cohortLabel', () => {
  it('is school plus term', () => {
    expect(cohortLabel({ school_name: 'Maryvale', term: '2026 Fall', class_name: 'P3' })).toBe(
      'Maryvale 2026 Fall',
    )
  })

  it('is just the school when there is no term', () => {
    expect(cohortLabel({ school_name: 'Maryvale', term: null, class_name: 'P3' })).toBe('Maryvale')
  })

  it('is the class name for the open class, which has no school', () => {
    expect(cohortLabel({ school_name: null, term: null, class_name: 'CIC Open' })).toBe('CIC Open')
  })
})

describe('buildCompletion', () => {
  it('returns one row per class, sorted', () => {
    const rows = buildCompletion(
      [progress({ class_id: 'b', class_name: 'Period 5' }), progress({ class_id: 'a' })],
      'class',
    )
    expect(rows.map((r) => r.class)).toEqual(['Period 3', 'Period 5'])
    expect(rows[0]).toEqual({
      cohort: 'Maryvale 2026 Fall',
      class: 'Period 3',
      students: 10,
      avg_completion_pct: 50,
    })
  })

  it('rolls classes up to a cohort, weighting each average by class size', () => {
    const rows = buildCompletion(
      [
        progress({ class_id: 'a', students: 10, avg_completion_pct: 50 }),
        progress({ class_id: 'b', class_name: 'Period 5', students: 30, avg_completion_pct: 70 }),
      ],
      'cohort',
    )
    expect(rows).toEqual([
      { cohort: 'Maryvale 2026 Fall', class: null, students: 40, avg_completion_pct: 65 },
    ])
  })

  it('leaves out a class under 5 students even if the source returned it', () => {
    const rows = buildCompletion(
      [progress({ class_id: 'a', students: 4 }), progress({ class_id: 'b', students: 5 })],
      'class',
    )
    expect(rows.map((r) => r.students)).toEqual([5])
  })

  it('never lets a hidden class feed a cohort total', () => {
    const rows = buildCompletion(
      [
        progress({ class_id: 'a', students: 12, avg_completion_pct: 40 }),
        progress({ class_id: 'b', class_name: 'Tiny', students: 3, avg_completion_pct: 100 }),
      ],
      'cohort',
    )
    expect(rows[0].students).toBe(12)
    expect(rows[0].avg_completion_pct).toBe(40)
  })

  it('filters by cohort, ignoring case', () => {
    const rows = buildCompletion(
      [progress({ class_id: 'a' }), progress({ class_id: 'b', school_name: 'Salt River' })],
      'class',
      'maryvale 2026 fall',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].cohort).toBe('Maryvale 2026 Fall')
  })

  it('returns nothing for an empty source', () => {
    expect(buildCompletion([], 'cohort')).toEqual([])
  })
})

describe('buildLearningGain', () => {
  it('returns one row per class, module and concept, with names', () => {
    const rows = buildLearningGain(
      [gain({}), gain({ concept_id: 'loops', concept_name: 'Loops', pre_pct: 30, post_pct: 70 })],
      'class',
    )
    expect(rows).toHaveLength(2)
    const loops = rows.find((r) => r.concept === 'Loops')
    expect(loops).toMatchObject({
      class: 'Period 3',
      module: 'Variables and Loops',
      pre_pct: 30,
      post_pct: 70,
      gain_points: 40,
    })
  })

  it('pools classes into a cohort with the true mean across students', () => {
    const rows = buildLearningGain(
      [
        gain({ class_id: 'a', complete_count: 10, incomplete_count: 1, pre_pct: 40, post_pct: 60 }),
        gain({ class_id: 'b', class_name: 'P5', complete_count: 30, incomplete_count: 4, pre_pct: 60, post_pct: 90 }),
      ],
      'cohort',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      class: null,
      complete_count: 40,
      incomplete_count: 5,
      pre_pct: 55,
      post_pct: 82.5,
      gain_points: 27.5,
      normalized_gain: 0.611,
    })
  })

  it('has no normalized gain when the pre score is already 100', () => {
    const [row] = buildLearningGain([gain({ pre_pct: 100, post_pct: 100 })], 'class')
    expect(row.normalized_gain).toBeNull()
    expect(row.gain_points).toBe(0)
  })

  it('leaves out classes with fewer than 5 complete students', () => {
    expect(buildLearningGain([gain({ complete_count: 4 })], 'class')).toEqual([])
  })

  it('skips rows with a missing pre or post score instead of counting them as zero', () => {
    expect(buildLearningGain([gain({ pre_pct: null })], 'class')).toEqual([])
    expect(buildLearningGain([gain({ post_pct: null })], 'class')).toEqual([])
  })

  it('keeps different modules and concepts apart', () => {
    const rows = buildLearningGain(
      [gain({}), gain({ module_id: 'm2', module_title: 'Functions' })],
      'cohort',
    )
    expect(rows.map((r) => r.module).sort()).toEqual(['Functions', 'Variables and Loops'])
  })
})
