import { describe, expect, it } from 'vitest'
import { checkRoster } from './roster'

describe('checkRoster', () => {
  it('accepts valid student names and skips the header', () => {
    const result = checkRoster('name\nAva Johnson\nMarcus Lee')

    expect(result.valid).toEqual(['Ava Johnson', 'Marcus Lee'])
    expect(result.problems).toEqual([])
  })

  it('normalizes whitespace and ignores blank lines', () => {
    const result = checkRoster('name\n  Ava   Johnson  \n\nMarcus Lee\n')

    expect(result.valid).toEqual(['Ava Johnson', 'Marcus Lee'])
    expect(result.problems).toEqual([])
  })

  it('detects duplicate names in the uploaded roster', () => {
    const result = checkRoster('name\nAva Johnson\nMarcus Lee\nAva Johnson')

    expect(result.valid).toEqual(['Ava Johnson', 'Marcus Lee'])
    expect(result.problems).toEqual([
      {
        line: 4,
        name: 'Ava Johnson',
        reason: 'Duplicate: already on line 2',
      },
    ])
  })

  it('detects students already in the class', () => {
    const result = checkRoster('name\nAva Johnson\nMarcus Lee', ['Ava Johnson'])

    expect(result.valid).toEqual(['Marcus Lee'])
    expect(result.problems[0]?.reason).toBe(
      'Duplicate: already in this class',
    )
  })

  it('rejects email addresses', () => {
    const result = checkRoster('name\nstudent@gmail.com')

    expect(result.valid).toEqual([])
    expect(result.problems[0]).toEqual({
      line: 2,
      name: 'student@gmail.com',
      reason: 'Looks like an email. Names only, please',
    })
  })

  it('rejects names longer than 80 characters', () => {
    const longName = 'A'.repeat(81)
    const result = checkRoster(`name\n${longName}`)

    expect(result.valid).toEqual([])
    expect(result.problems[0]?.reason).toBe('Name is too long')
  })

  it('detects duplicates case-insensitively', () => {
    const result = checkRoster('name\nAva Johnson\nava johnson')

    expect(result.valid).toEqual(['Ava Johnson'])
    expect(result.problems[0]?.reason).toBe(
      'Duplicate: already on line 2',
    )
  })
})