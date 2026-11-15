import { describe, expect, it } from 'vitest'
import { buildReport, headline, reportCsv, type GainRow } from '../report'

const row = (over: Partial<GainRow>): GainRow => ({
  module_id: 'm1', concept_id: null, pre_pct: 40, post_pct: 72.5, gain_points: 32.5, normalized_gain: 0.5417, complete_count: 10, incomplete_count: 1, ...over,
})
const titles = new Map([['m1', 'Variables and Loops'], ['m2', 'Functions']])
const names = new Map([['loops', 'Loops'], ['variables', 'Variables']])
const rows = [
  row({}),
  row({ concept_id: 'loops', pre_pct: 30, post_pct: 75, gain_points: 45, normalized_gain: 0.64 }),
  row({ concept_id: 'variables', pre_pct: 50, post_pct: 70, gain_points: 20, normalized_gain: 0.4 }),
]

describe('buildReport', () => {
  it('groups by module, names concepts and rounds for display', () => {
    const [m] = buildReport('Period 1', rows, titles, names)
    expect(m!.title).toBe('Variables and Loops')
    expect(m!.overall).toMatchObject({ pre: 40, post: 72.5, gain: 32.5, normalizedGain: 0.54, measured: 10, incomplete: 1 })
    expect(m!.concepts.map((c) => [c.label, c.gain])).toEqual([['Loops', 45], ['Variables', 20]])
    expect(m!.smallGroup).toBe(false)
  })

  it('writes a headline a funder can quote, naming the biggest concept gain', () => {
    const [m] = buildReport('Period 1', rows, titles, names)
    expect(m!.headline).toBe('10 students in Period 1 went from 40% on the pre-test to 73% on the post-test (+33 points). The biggest gain was in Loops: +45 points.')
  })

  it('never invents a number when nobody has both tests', () => {
    const [m] = buildReport('Period 1', [row({ pre_pct: 50, post_pct: null, gain_points: null, normalized_gain: null, complete_count: 0, incomplete_count: 4 })], titles, names)
    expect(m!.headline).toMatch(/no learning gain to report/)
    expect(m!.overall!.gain).toBeNull()
    expect(headline('P', null, [])).toMatch(/no learning gain/)
  })

  it('flags a small group, and keeps modules apart', () => {
    const list = buildReport('P', [row({ complete_count: 3 }), row({ module_id: 'm2' })], titles, names)
    expect(list.map((m) => [m.title, m.smallGroup])).toEqual([['Functions', false], ['Variables and Loops', true]])
  })
})

describe('reportCsv', () => {
  it('has one row for the module and one per concept, with blank cells for missing numbers and no student', () => {
    const [m] = buildReport('Period 1', [...rows, row({ concept_id: 'variables', module_id: 'm1', gain_points: null, normalized_gain: null, post_pct: null })].slice(0, 3), titles, names)
    const csv = reportCsv('Period 1', m!)
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('class,module,concept,pre_pct,post_pct,gain_points,normalized_gain,students_measured,students_incomplete')
    expect(lines[1]).toBe('Period 1,Variables and Loops,all concepts,40,72.5,32.5,0.54,10,1')
    expect(lines).toHaveLength(4)
    const blank = reportCsv('P', buildReport('P', [row({ gain_points: null, post_pct: null, normalized_gain: null })], titles, names)[0]!)
    expect(blank.split('\r\n')[1]).toBe('P,Variables and Loops,all concepts,40,,,,10,1')
  })

  it('cannot start a spreadsheet formula from a class name', () => {
    const [m] = buildReport('=HACK()', rows, titles, names)
    expect(reportCsv('=HACK()', m!).split('\r\n')[1]!.startsWith("'=HACK()")).toBe(true)
  })
})
