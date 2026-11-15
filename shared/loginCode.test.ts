import { describe, expect, it } from 'vitest'
import { classifyCode, normalizeCode } from './loginCode'

describe('classifyCode', () => {
  it('treats 12 characters as a class join code, whatever the case, spaces or dashes', () => {
    expect(classifyCode('DEMO-JOIN-1234')).toEqual({ kind: 'join', code: 'DEMO-JOIN-1234' })
    expect(classifyCode(' demo join 1234 ')).toEqual({ kind: 'join', code: 'DEMO-JOIN-1234' })
  })

  it('treats 16 characters as a personal login code', () => {
    expect(classifyCode('DEMO-0000-0000-0001')).toEqual({ kind: 'login', code: 'DEMO-0000-0000-0001' })
    expect(classifyCode('demo0000000000001')).toEqual({ kind: 'invalid' })   // 17
    expect(classifyCode('demo000000000001')).toEqual({ kind: 'login', code: 'DEMO-0000-0000-0001' })
  })

  it('rejects any other length, including empty input', () => {
    for (const bad of ['', 'ABCD', 'ABCD-EFGH-IJK', 'ABCD-EFGH-IJKLM', '----', 'a'.repeat(20)]) {
      expect(classifyCode(bad)).toEqual({ kind: 'invalid' })
    }
  })

  it('normalizeCode groups by four and drops punctuation', () => {
    expect(normalizeCode('ab12cd34ef56')).toBe('AB12-CD34-EF56')
  })
})
