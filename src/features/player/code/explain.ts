import type { PyError } from './protocol'

// Python's own error messages are written for programmers. Research on novice programmers (Becker et al.
// 2019) finds that plain explanations next to the real message help them fix the problem. Shown with the
// original message, never instead of it.
export function explainError(e: PyError): string {
  const text = explain(e)
  return e.line ? `On line ${e.line}: ${text}` : text.charAt(0).toUpperCase() + text.slice(1)
}

function explain(e: PyError): string {
  const name = /name '([^']+)' is not defined/.exec(e.message)?.[1]
  switch (e.type) {
    case 'SyntaxError':
      return `Python couldn't read this line. Look for a missing colon at the end of an if, for, while or def line, or a missing bracket or quote.`
    case 'IndentationError':
    case 'TabError':
      return `the spaces at the start of the lines don't line up. Lines inside a loop, if or def need the same indent (4 spaces).`
    case 'NameError':
      return `Python doesn't know ${name ? `the name "${name}"` : 'this name'} yet. Check the spelling, and set it before you use it.`
    case 'TypeError':
      return `two kinds of values don't go together here, like adding a number to text. str() turns a number into text, and int() turns text into a number.`
    case 'ZeroDivisionError':
      return `the code divides by zero, which has no answer. Check the number you divide by.`
    case 'IndexError':
      return `the code asks for a position that the list doesn't have. Positions start at 0, so the last one is the length minus 1.`
    case 'KeyError':
      return `the code asks a dictionary for a key it doesn't have. Check the spelling of the key.`
    case 'ValueError':
      return `a value has the right type but the wrong content, like int("hello").`
    case 'AttributeError':
      return `this value doesn't have that method or property. Check the spelling, and what type the value is.`
    case 'RuntimeError':
      return /input\(\)/.test(e.message) ? 'input() is not available here. Put the value straight into your code instead.' : `something went wrong while the code ran.`
    default:
      return `something went wrong while the code ran. Read the message below and check that line.`
  }
}
