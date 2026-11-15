// Tells the two kinds of code a person can type into the student sign-in box apart.
// Both are hex, printed in groups of four: a class join code is 12 characters
// (XXXX-XXXX-XXXX), a personal login code is 16 (XXXX-XXXX-XXXX-XXXX). The database
// ignores case, spaces and dashes, so this only decides where to send the person.

export type CodeKind =
  | { kind: 'join'; code: string }
  | { kind: 'login'; code: string }
  | { kind: 'invalid' }

/** Strips everything that is not a letter or digit, upper-cases, and groups in fours with dashes. */
export function normalizeCode(input: string): string {
  const clean = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return clean.replace(/(.{4})(?=.)/g, '$1-')
}

export function classifyCode(input: string): CodeKind {
  const length = input.replace(/[^A-Za-z0-9]/g, '').length
  if (length === 12) return { kind: 'join', code: normalizeCode(input) }
  if (length === 16) return { kind: 'login', code: normalizeCode(input) }
  return { kind: 'invalid' }
}
