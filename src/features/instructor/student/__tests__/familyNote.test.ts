import { describe, expect, it } from 'vitest'
import { demoReportInput } from '../demoReport'
import { draftNoteHome } from '../familyNote'
import { buildStudentReport } from '../report'

describe('draftNoteHome', () => {
  it('writes a positive-first note from the report, with no scores the family cannot read', () => {
    const report = buildStudentReport(demoReportInput(new Date('2026-11-15T12:00:00Z'), 'Maya R.'))
    const note = draftNoteHome(report)
    expect(note).toMatch(/^Hello! This is a quick note from .+ at Coding in Color about Maya R\./)
    expect(note).toMatch(/has finished \d+ of \d+ activities/)
    expect(note).toMatch(/Thank you for supporting Maya R\./)
    expect(note).not.toMatch(/\u2014/) // no em dashes
    expect(note).not.toMatch(/stuck|behind|failed/i)
  })
})
