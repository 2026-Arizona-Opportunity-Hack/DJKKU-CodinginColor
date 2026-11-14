/**
 * Seed content for the in-memory mock (B15): 1 class, 2 modules, pre/post tests,
 * every activity kind and every question type. Answer keys live here only, the way
 * they live only on the server in the real system.
 *
 * Demo codes: login code BLUE-FOX-27 (Maya R.), join code SAT-CODERS.
 */
import type { ActivityContent, Question } from '@/shared/content'

export type AnswerKey =
  | { type: 'mcq'; choice_id: string }
  | { type: 'short_answer'; accept: string[] }
  | { type: 'fill_blank'; blanks: string[] }
  | { type: 'ordering'; order: string[] }
  | { type: 'reflection' }

export type SeedActivity = {
  activity_id: string
  title: string
  required: boolean
  feedback?: { correct: string; incorrect: string }
  explanation?: string
  keys: Record<string, AnswerKey>
} & ActivityContent

export type SeedLesson = { lesson_id: string; title: string; activities: SeedActivity[] }
export type SeedAssessment = {
  assessment_id: string
  kind: 'pre' | 'post'
  items: (Question & { concept: string })[]
  keys: Record<string, AnswerKey>
}
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

const mcq = (id: string, prompt: string, choices: [string, string][]): Question => ({
  id,
  type: 'mcq',
  prompt,
  choices: choices.map(([cid, text]) => ({ id: cid, text })),
})

function assessment(id: string, kind: 'pre' | 'post', topic: 'basics' | 'functions'): SeedAssessment {
  if (topic === 'basics') {
    return {
      assessment_id: id,
      kind,
      items: [
        { ...mcq(`${id}-q1`, 'Which line stores the number 5 in a variable named x?', [['a', 'x = 5'], ['b', '5 = x'], ['c', 'x == 5']]), concept: 'variables' },
        { ...mcq(`${id}-q2`, 'How many times does `for i in range(3):` run its body?', [['a', '2'], ['b', '3'], ['c', '4']]), concept: 'loops' },
        { id: `${id}-q3`, type: 'short_answer', prompt: 'What keyword starts a loop that repeats while a condition is true?', concept: 'loops' },
      ],
      keys: {
        [`${id}-q1`]: { type: 'mcq', choice_id: 'a' },
        [`${id}-q2`]: { type: 'mcq', choice_id: 'b' },
        [`${id}-q3`]: { type: 'short_answer', accept: ['while'] },
      },
    }
  }
  return {
    assessment_id: id,
    kind,
    items: [
      { ...mcq(`${id}-q1`, 'Which keyword defines a function in Python?', [['a', 'func'], ['b', 'def'], ['c', 'function']]), concept: 'functions' },
      { id: `${id}-q2`, type: 'short_answer', prompt: 'What keyword sends a value back from a function?', concept: 'functions' },
    ],
    keys: {
      [`${id}-q1`]: { type: 'mcq', choice_id: 'b' },
      [`${id}-q2`]: { type: 'short_answer', accept: ['return'] },
    },
  }
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
              youtube_id: 'Z1Yd7upQsXY',
              transcript:
                'A variable is a name that points to a value. In Python you write the name, an equals sign, and the value: x = 5.',
            },
            keys: {},
          },
          {
            activity_id: 'act-vars-read',
            title: 'Read: naming things',
            required: true,
            kind: 'reading',
            content: {
              markdown:
                '## Naming things\n\nA **variable** gives a value a name.\n\n```python\nscore = 10\nplayer_name = "Maya"\n```\n\n- Use lowercase words joined by `_`.\n- Names can\'t start with a number.\n\nRead more in the [Python tutorial](https://docs.python.org/3/tutorial/introduction.html).',
            },
            keys: {},
          },
          {
            activity_id: 'act-vars-check',
            title: 'Variables check',
            required: true,
            kind: 'check',
            content: {
              question: mcq('q-vars-1', 'After `x = 3` and then `x = x + 2`, what is x?', [
                ['a', '3'],
                ['b', '5'],
                ['c', '32'],
              ]),
            },
            feedback: { correct: 'Yes: x + 2 uses the old value, 3.', incorrect: 'Not quite. Work out x + 2 using the value x had before.' },
            explanation: 'The right side is computed first, then stored back into x.',
            keys: { 'q-vars-1': { type: 'mcq', choice_id: 'b' } },
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
            content: {
              items: [
                { id: 'q-loop-sa', type: 'short_answer', prompt: 'Which built-in function gives you a sequence of numbers for a for-loop?' },
                { id: 'q-loop-fb', type: 'fill_blank', prompt: 'Complete the loop: `___ i in ___(5):`', blanks: 2 },
                {
                  id: 'q-loop-ord',
                  type: 'ordering',
                  prompt: 'Put these lines in order to print 0, 1, 2.',
                  items: [
                    { id: 'l3', text: 'i = i + 1' },
                    { id: 'l1', text: 'i = 0' },
                    { id: 'l2', text: 'while i < 3: print(i)' },
                  ],
                },
              ],
            },
            keys: {
              'q-loop-sa': { type: 'short_answer', accept: ['range', 'range()'] },
              'q-loop-fb': { type: 'fill_blank', blanks: ['for', 'range'] },
              'q-loop-ord': { type: 'ordering', order: ['l1', 'l2', 'l3'] },
            },
          },
          {
            activity_id: 'act-loops-check',
            title: 'Loops check',
            required: true,
            kind: 'check',
            content: { question: { id: 'q-loop-c1', type: 'fill_blank', prompt: 'A loop that runs while a condition is true starts with ___.', blanks: 1 } },
            feedback: { correct: 'Right: while keeps going until the condition is false.', incorrect: 'Close. Think of the word that means "as long as".' },
            keys: { 'q-loop-c1': { type: 'fill_blank', blanks: ['while'] } },
          },
          {
            activity_id: 'act-basics-exit',
            title: 'Exit ticket: basics',
            required: true,
            kind: 'exit',
            content: { question: { id: 'q-basics-exit', type: 'reflection', prompt: 'What was the hardest part of loops today, and what helped?' } },
            keys: { 'q-basics-exit': { type: 'reflection' } },
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
          {
            activity_id: 'act-fn-video',
            title: 'Watch: functions',
            required: true,
            kind: 'video',
            content: { youtube_id: '9Os0o3wzS_I' },
            keys: {},
          },
          {
            activity_id: 'act-fn-check',
            title: 'Functions check',
            required: true,
            kind: 'check',
            content: { question: mcq('q-fn-1', 'What does `def greet():` do?', [['a', 'Calls greet'], ['b', 'Defines greet'], ['c', 'Deletes greet']]) },
            feedback: { correct: 'Yes: def defines it; greet() calls it.', incorrect: 'Not quite. Defining and calling are different steps.' },
            keys: { 'q-fn-1': { type: 'mcq', choice_id: 'b' } },
          },
          {
            activity_id: 'act-fn-exit',
            title: 'Exit ticket: functions',
            required: true,
            kind: 'exit',
            content: { question: mcq('q-fn-exit', 'Which line calls a function named greet?', [['a', 'greet()'], ['b', 'def greet'], ['c', 'greet']]) },
            keys: { 'q-fn-exit': { type: 'mcq', choice_id: 'a' } },
          },
        ],
      },
    ],
  },
]

export const SEED_HINTS = [
  'Re-read the question and underline the key word.',
  'Look back at the example in the reading for this lesson.',
  'Try the simplest case first, then check your answer against it.',
]
