import { describe, expect, it } from 'vitest'
import { CreateClassSchema } from './classes'

describe('CreateClassSchema', () => {
  it('trims, and treats the term as optional', () => {
    expect(CreateClassSchema.parse({ schoolName: ' Maryvale ', name: ' Period 1 ' })).toEqual({ schoolName: 'Maryvale', name: 'Period 1' })
    expect(CreateClassSchema.parse({ schoolName: 'M', name: 'P', term: ' Fall 2026 ' }).term).toBe('Fall 2026')
  })

  it('rejects empty and over-long values, with messages a person can act on', () => {
    expect(CreateClassSchema.safeParse({ schoolName: '  ', name: 'P' }).error?.issues[0]?.message).toBe('Enter the school name.')
    expect(CreateClassSchema.safeParse({ schoolName: 'M', name: '' }).error?.issues[0]?.message).toBe('Enter the class name.')
    expect(CreateClassSchema.safeParse({ schoolName: 'M', name: 'x'.repeat(121) }).success).toBe(false)
    expect(CreateClassSchema.safeParse({ schoolName: 'M', name: 'x'.repeat(120) }).success).toBe(true)
    expect(CreateClassSchema.safeParse({ schoolName: 'M', name: 'P', term: 'x'.repeat(41) }).success).toBe(false)
  })
})
