/**
 * Seed content for the in-memory mock (B15): 1 class, 2 modules, pre/post tests,
 * every activity kind and every question type. Questions are written in lane C's
 * authored shape (content + key) and split with lane C's splitQuestion(), so the mock
 * hands out exactly what the real server would and keeps keys to itself.
 *
 * Demo codes: login code BLUE-FOX-27 (Maya R.), join code SAT-CODERS.
 */
import type { AuthoredQuestion } from '@shared/authoring/schemas'

type Feedback = { correct: string; incorrect: string }
type Base = { activity_id: string; title: string; required: boolean; feedback?: Feedback }

export type SeedActivity = Base &
  (
    | { kind: 'video'; content: { embedUrl: string; transcript?: string } }
    | { kind: 'reading'; content: { body: string } }
    | { kind: 'check' | 'worksheet' | 'exit'; questions: AuthoredQuestion[] }
  )

export type SeedLesson = { lesson_id: string; title: string; activities: SeedActivity[] }
export type SeedAssessment = { assessment_id: string; kind: 'pre' | 'post'; items: { pairKey: string; question: AuthoredQuestion }[] }
export type SeedModule = {
  module_id: string
  title: string
  summary: string
  open: boolean
  pretest: SeedAssessment
  posttest: SeedAssessment
  lessons: SeedLesson[]
}

export const SEED_CLASS = { class_id: 'class-sat', class_name: 'Saturday Coders', kind: 'cohort' } as const
export const SEED_LOGIN_CODES: Record<string, { member_id: string; display_name: string }> = {
  'BLUE-FOX-27': { member_id: 'm-maya', display_name: 'Maya R.' },
}
export const SEED_JOIN_CODE = 'SAT-CODERS'
export const SEED_ROSTER = [
  { member_id: 'm-jordan', label: 'Jordan T.' },
  { member_id: 'm-ava', label: 'Ava K.' },
  { member_id: 'm-luis', label: 'Luis M.' },
]

const hints = ['Re-read the question and underline the key word.', 'Look back at the example in this lesson.', 'Try the simplest case first.']

function mcq(id: string, conceptId: string, prompt: string, choices: [string, string][], correct: string): AuthoredQuestion {
  return {
    content: { id, conceptId, type: 'mcq', prompt, choices: choices.map(([cid, text]) => ({ id: cid, text })) },
    key: { type: 'mcq', correctChoiceId: correct, hints },
  }
}
function shortAnswer(id: string, conceptId: string, prompt: string, accepted: string[]): AuthoredQuestion {
  return { content: { id, conceptId, type: 'short_answer', prompt }, key: { type: 'short_answer', accepted, caseSensitive: false, hints } }
}

function assessment(id: string, kind: 'pre' | 'post', topic: 'basics' | 'functions'): SeedAssessment {
  const items =
    topic === 'basics'
      ? [
          mcq(`${id}-q1`, 'variables', 'Which line stores the number 5 in a variable named x?', [['a', 'x = 5'], ['b', '5 = x'], ['c', 'x == 5']], 'a'),
          mcq(`${id}-q2`, 'loops', 'How many times does `for i in range(3):` run its body?', [['a', '2'], ['b', '3'], ['c', '4']], 'b'),
          shortAnswer(`${id}-q3`, 'loops', 'What keyword starts a loop that repeats while a condition is true?', ['while']),
        ]
      : [
          mcq(`${id}-q1`, 'functions', 'Which keyword defines a function in Python?', [['a', 'func'], ['b', 'def'], ['c', 'function']], 'b'),
          shortAnswer(`${id}-q2`, 'functions', 'What keyword sends a value back from a function?', ['return']),
        ]
  return { assessment_id: id, kind, items: items.map((question, i) => ({ pairKey: `${topic}-${i + 1}`, question })) }
}

export const SEED_MODULES: SeedModule[] = [
  {
    module_id: 'mod-basics',
    title: 'Python basics',
    summary: 'Variables and loops: the building blocks of every program.',
    open: true,
    pretest: assessment('pre-basics', 'pre', 'basics'),
    posttest: assessment('post-basics', 'post', 'basics'),
    lessons: [
      {
        lesson_id: 'les-vars',
        title: 'Variables',
        activities: [
          {
            activity_id: 'act-vars-video',
            title: 'Watch: what is a variable?',
            required: true,
            kind: 'video',
            content: {
              embedUrl: 'https://www.youtube-nocookie.com/embed/Z1Yd7upQsXY',
              transcript: 'A variable is a name that points to a value. In Python you write the name, an equals sign, and the value: x = 5.',
            },
          },
          {
            activity_id: 'act-vars-read',
            title: 'Read: naming things',
            required: true,
            kind: 'reading',
            content: {
              body: '## Naming things\n\nA **variable** gives a value a name.\n\n```python\nscore = 10\nplayer_name = "Maya"\n```\n\n- Use lowercase words joined by `_`.\n- Names can\'t start with a number.\n\nRead more in the [Python tutorial](https://docs.python.org/3/tutorial/introduction.html).',
            },
          },
          {
            activity_id: 'act-vars-check',
            title: 'Variables check',
            required: true,
            kind: 'check',
            feedback: { correct: 'Yes: x + 2 uses the old value, 3.', incorrect: 'Not quite. Work out x + 2 using the value x had before.' },
            questions: [mcq('q-vars-1', 'variables', 'After `x = 3` and then `x = x + 2`, what is x?', [['a', '3'], ['b', '5'], ['c', '32']], 'b')],
          },
        ],
      },
      {
        lesson_id: 'les-loops',
        title: 'Loops',
        activities: [
          {
            activity_id: 'act-loops-sheet',
            title: 'Loops worksheet',
            required: true,
            kind: 'worksheet',
            questions: [
              shortAnswer('q-loop-sa', 'loops', 'Which built-in function gives you a sequence of numbers for a for-loop?', ['range', 'range()']),
              {
                content: { id: 'q-loop-fb', conceptId: 'loops', type: 'fill_blank', prompt: 'Complete the loop: ___ i in ___(5):' },
                key: { type: 'fill_blank', blanks: [['for'], ['range']], caseSensitive: false, hints },
              },
              {
                content: {
                  id: 'q-loop-ord',
                  conceptId: 'loops',
                  type: 'ordering',
                  prompt: 'Put these lines in order to print 0, 1, 2.',
                  items: [
                    { id: 'l1', text: 'i = 0' },
                    { id: 'l2', text: 'while i < 3: print(i)' },
                    { id: 'l3', text: 'i = i + 1' },
                  ],
                },
                key: { type: 'ordering', correctOrder: ['l1', 'l2', 'l3'], hints },
              },
            ],
          },
          {
            activity_id: 'act-loops-check',
            title: 'Loops check',
            required: true,
            kind: 'check',
            feedback: { correct: 'Right: while keeps going until the condition is false.', incorrect: 'Close. Think of the word that means "as long as".' },
            questions: [
              {
                content: { id: 'q-loop-c1', conceptId: 'loops', type: 'fill_blank', prompt: 'A loop that runs while a condition is true starts with ___.' },
                key: { type: 'fill_blank', blanks: [['while']], caseSensitive: false, hints },
              },
            ],
          },
          {
            activity_id: 'act-basics-exit',
            title: 'Exit ticket: basics',
            required: true,
            kind: 'exit',
            questions: [{ content: { id: 'q-basics-exit', type: 'reflection', prompt: 'What was the hardest part of loops today, and what helped?' }, key: null }],
          },
        ],
      },
    ],
  },
  {
    module_id: 'mod-functions',
    title: 'Functions',
    summary: 'Package code you can reuse.',
    open: false,
    pretest: assessment('pre-functions', 'pre', 'functions'),
    posttest: assessment('post-functions', 'post', 'functions'),
    lessons: [
      {
        lesson_id: 'les-def',
        title: 'Defining functions',
        activities: [
          { activity_id: 'act-fn-video', title: 'Watch: functions', required: true, kind: 'video', content: { embedUrl: 'https://www.youtube-nocookie.com/embed/9Os0o3wzS_I' } },
          {
            activity_id: 'act-fn-check',
            title: 'Functions check',
            required: true,
            kind: 'check',
            feedback: { correct: 'Yes: def defines it; greet() calls it.', incorrect: 'Not quite. Defining and calling are different steps.' },
            questions: [mcq('q-fn-1', 'functions', 'What does `def greet():` do?', [['a', 'Calls greet'], ['b', 'Defines greet'], ['c', 'Deletes greet']], 'b')],
          },
          {
            activity_id: 'act-fn-exit',
            title: 'Exit ticket: functions',
            required: true,
            kind: 'exit',
            questions: [mcq('q-fn-exit', 'functions', 'Which line calls a function named greet?', [['a', 'greet()'], ['b', 'def greet'], ['c', 'greet']], 'a')],
          },
        ],
      },
    ],
  },
]

export const FALLBACK_HINTS = hints
