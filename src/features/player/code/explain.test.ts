import { describe, expect, it } from 'vitest'
import { explainError } from './explain'

describe('explainError', () => {
  it('names the line and the missing name for a NameError', () => {
    expect(explainError({ type: 'NameError', message: "name 'totl' is not defined", line: 3 })).toBe(
      'On line 3: Python doesn\'t know the name "totl" yet. Check the spelling, and set it before you use it.',
    )
  })

  it('starts with a capital letter when there is no line number', () => {
    expect(explainError({ type: 'IndentationError', message: 'expected an indented block', line: null })).toMatch(/^The spaces/)
  })

  it.each(['SyntaxError', 'TypeError', 'ZeroDivisionError', 'IndexError', 'KeyError', 'ValueError', 'AttributeError'])(
    'has a plain explanation for %s',
    (type) => {
      const text = explainError({ type, message: 'x', line: 1 })
      expect(text).toMatch(/^On line 1: /)
      expect(text).not.toMatch(/something went wrong/)
    },
  )

  it('explains that input() is not available', () => {
    expect(explainError({ type: 'RuntimeError', message: 'input() is not available here', line: 1 })).toMatch(/input\(\) is not available/)
  })

  it('falls back to a general message for anything else', () => {
    expect(explainError({ type: 'RecursionError', message: 'maximum recursion depth exceeded', line: 2 })).toMatch(/^On line 2: something went wrong/)
  })
})
