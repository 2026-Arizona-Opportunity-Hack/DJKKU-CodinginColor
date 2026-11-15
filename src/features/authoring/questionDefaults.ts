import type { AuthoredQuestion, QuestionContent } from '@shared/authoring/schemas'

export type QuestionType = QuestionContent['type']
export const QUESTION_LABEL: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  short_answer: 'Short answer',
  fill_blank: 'Fill in the blank',
  ordering: 'Ordering',
  reflection: 'Reflection',
}
export const QUESTION_TYPES = Object.keys(QUESTION_LABEL) as QuestionType[]

/** A short id made once, when the question (or choice) is created. Keys and progress refer to it. */
export const shortId = (prefix: string, n = 6) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, n)}`

export function newQuestion(type: QuestionType, conceptId: string): AuthoredQuestion {
  const id = shortId('q')
  const base = { id, prompt: '', conceptId }
  switch (type) {
    case 'mcq':
      return { content: { ...base, type, choices: [{ id: shortId('c', 4), text: '' }, { id: shortId('c', 4), text: '' }] }, key: { type, correctChoiceId: '', hints: [] } }
    case 'short_answer':
      return { content: { ...base, type }, key: { type, accepted: [], caseSensitive: false, hints: [] } }
    case 'fill_blank':
      return { content: { ...base, type }, key: { type, blanks: [], caseSensitive: false, hints: [] } }
    case 'ordering': {
      const items = [{ id: shortId('i', 4), text: '' }, { id: shortId('i', 4), text: '' }]
      return { content: { ...base, type, items }, key: { type, correctOrder: items.map((i) => i.id), hints: [] } }
    }
    case 'reflection':
      return { content: { id, prompt: '', type }, key: null }
  }
}

type ErrorNode = { message?: unknown; [k: string]: unknown }

/** Every validation message under a form error node, reworded where the raw message is unclear. */
export function errorMessages(node: unknown, path = ''): string[] {
  if (!node || typeof node !== 'object') return []
  const n = node as ErrorNode
  const out: string[] = []
  if (typeof n.message === 'string') {
    if (/conceptId$/.test(path)) out.push('Pick a concept for this question.')
    else if (/correctChoiceId$/.test(path)) out.push('Pick the correct answer.')
    else if (/prompt$/.test(path) && n.message === 'Required') out.push('Write the question.')
    else if (/choices\.\d+\.text$/.test(path)) out.push('Fill in every choice.')
    else if (/items\.\d+\.text$/.test(path)) out.push('Fill in every item.')
    else if (/accepted$/.test(path)) out.push('Add at least one accepted answer.')
    else if (/blanks\.\d+$/.test(path)) out.push('Add at least one accepted answer for every blank.')
    else if (/hints\.\d+$/.test(path)) out.push('Fill in or remove the empty hint.')
    else out.push(n.message)
  }
  for (const [k, v] of Object.entries(n)) if (k !== 'message' && k !== 'ref' && k !== 'type') out.push(...errorMessages(v, path ? `${path}.${k}` : k))
  return [...new Set(out)]
}
