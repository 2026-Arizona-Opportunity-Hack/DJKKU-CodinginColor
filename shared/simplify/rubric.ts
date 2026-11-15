// The grade rubric for "Explain it for my grade". One entry per grade, 1 to 12, on the same dimensions,
// so a teacher can see exactly how grade 3 differs from grade 9. It guides the AI rewrite and is shown in
// docs/grade-rubric.md. Reading levels follow common grade-band expectations (Lexile-style bands and the
// Common Core reading progression), and the explanation style follows the K-12 CS Framework's grade bands
// (K-2, 3-5, 6-8, 9-12). CIC can tune any line without touching code elsewhere.

export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
export const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export interface GradeRubric {
  grade: Grade
  band: 'K-2' | '3-5' | '6-8' | '9-12'
  /** Words a student at this grade knows, and how new words are handled. */
  vocabulary: string
  /** Sentence length and shape. */
  sentences: string
  /** How a concept is built up: concrete to abstract. */
  conceptualizing: string
  /** What examples and analogies come from. */
  examples: string
  /** Which technical terms may appear, and how. */
  technicalTerms: string
  /** Code shown, if any. */
  code: string
  /** How long the explanation is. */
  length: string
  /** The one question that checks understanding. */
  checkQuestion: string
  /** Most words in the explanation (the model is told this cap). */
  maxWords: number
}

export const RUBRIC: Record<Grade, GradeRubric> = {
  1: {
    grade: 1, band: 'K-2',
    vocabulary: 'Only very common words a 6 year old says every day. No jargon at all.',
    sentences: 'Very short sentences, 5 to 8 words. One idea per sentence.',
    conceptualizing: 'One big idea only, shown as something the child can see or do. No abstractions.',
    examples: 'Toys, snacks, pets, colors, family, playground games. Act it out ("clap 3 times").',
    technicalTerms: 'None. Say "a list of steps" instead of "program", "do it again" instead of "loop".',
    code: 'No code. Describe steps as a numbered list of actions.',
    length: 'About 60 words plus a 3-step list.',
    checkQuestion: 'A yes/no or pick-one question about the everyday example.',
    maxWords: 90,
  },
  2: {
    grade: 2, band: 'K-2',
    vocabulary: 'Everyday words; one new word at most, explained with a picture-like comparison.',
    sentences: 'Short sentences, 6 to 10 words.',
    conceptualizing: 'One idea, built from a familiar routine (brushing teeth, a recipe).',
    examples: 'Recipes, games like Simon Says, lining up at school, sorting crayons.',
    technicalTerms: 'At most one simple term (like "step" or "repeat"), always with its meaning.',
    code: 'No code. Steps as a numbered list.',
    length: 'About 80 words plus a short list.',
    checkQuestion: 'Pick-one question about what happens next in the example.',
    maxWords: 110,
  },
  3: {
    grade: 3, band: '3-5',
    vocabulary: 'Common words; new words introduced one at a time with "this means...".',
    sentences: 'Sentences of 8 to 12 words.',
    conceptualizing: 'Idea first as an everyday story, then named.',
    examples: 'Board games, sports scores, video game lives, classroom jobs.',
    technicalTerms: 'Up to two terms such as "instruction" or "repeat", each defined in plain words.',
    code: 'Optional: one tiny block-style or pseudocode example, 1 to 3 lines.',
    length: 'About 100 words.',
    checkQuestion: 'Pick-one question with a tiny scenario.',
    maxWords: 140,
  },
  4: {
    grade: 4, band: '3-5',
    vocabulary: 'Plain words; new terms in bold with a short meaning.',
    sentences: 'Sentences of 10 to 14 words.',
    conceptualizing: 'Everyday story, then the name, then "why it helps".',
    examples: 'Scoreboards, playlists, recipes that repeat a step, sorting a deck of cards.',
    technicalTerms: 'Up to three terms (for example "variable", "loop"), each explained with an example.',
    code: 'One short example of 2 to 4 lines, each line explained.',
    length: 'About 120 words.',
    checkQuestion: 'Predict what a tiny example does.',
    maxWords: 160,
  },
  5: {
    grade: 5, band: '3-5',
    vocabulary: 'Grade-level words; terms in bold with meanings.',
    sentences: 'Sentences of 10 to 15 words.',
    conceptualizing: 'Analogy, then the real idea, then one example.',
    examples: 'Games, school schedules, simple apps they use, sports stats.',
    technicalTerms: 'Core terms of the lesson, each defined once.',
    code: 'One example of up to 5 lines with comments in plain words.',
    length: 'About 140 words.',
    checkQuestion: 'Predict the output of a short example.',
    maxWords: 180,
  },
  6: {
    grade: 6, band: '6-8',
    vocabulary: 'Grade-level academic words; technical terms defined at first use.',
    sentences: 'Sentences of 12 to 16 words, some with "because" or "so".',
    conceptualizing: 'Idea, why it exists, then a worked example.',
    examples: 'Video games, social apps, music playlists, school data like grades and attendance.',
    technicalTerms: 'All lesson terms, defined briefly; avoid extra jargon.',
    code: 'One example of up to 6 lines, walked through step by step.',
    length: 'About 160 words.',
    checkQuestion: 'Predict output or spot a small bug.',
    maxWords: 200,
  },
  7: {
    grade: 7, band: '6-8',
    vocabulary: 'Academic words; technical terms defined once, then used.',
    sentences: 'Varied sentences, 12 to 18 words.',
    conceptualizing: 'Idea, purpose, worked example, common mistake.',
    examples: 'Games, apps, sports analytics, simple websites.',
    technicalTerms: 'Lesson terms used correctly after a short definition.',
    code: 'Up to 8 lines with a trace of what happens.',
    length: 'About 180 words.',
    checkQuestion: 'Spot the bug or predict output.',
    maxWords: 220,
  },
  8: {
    grade: 8, band: '6-8',
    vocabulary: 'Academic and technical words with short definitions.',
    sentences: 'Varied sentences up to 20 words.',
    conceptualizing: 'Idea, purpose, example, common mistake, when to use it.',
    examples: 'Apps, games, data from science class, small automation tasks.',
    technicalTerms: 'Correct terms throughout; a mini glossary of key terms.',
    code: 'Up to 10 lines with a step-by-step trace.',
    length: 'About 200 words.',
    checkQuestion: 'Change the code to do something slightly different.',
    maxWords: 240,
  },
  9: {
    grade: 9, band: '9-12',
    vocabulary: 'Technical vocabulary with brief definitions for new terms.',
    sentences: 'Clear, varied sentences; short paragraphs.',
    conceptualizing: 'Concept, how it works, worked example, pitfalls, connection to earlier ideas.',
    examples: 'Real apps and projects: a game score system, a playlist app, a data report.',
    technicalTerms: 'Precise terms expected; glossary for new ones.',
    code: 'Up to 12 lines; explain what each part does.',
    length: 'About 220 words.',
    checkQuestion: 'Explain why a piece of code gives its output.',
    maxWords: 260,
  },
  10: {
    grade: 10, band: '9-12',
    vocabulary: 'Technical vocabulary used precisely.',
    sentences: 'Clear paragraphs, some longer sentences when needed.',
    conceptualizing: 'Concept, mechanism, example, trade-offs, where it shows up in real software.',
    examples: 'Real software and careers: web apps, data science, game development.',
    technicalTerms: 'Precise terms without over-explaining basics.',
    code: 'Up to 15 lines; idiomatic style.',
    length: 'About 240 words.',
    checkQuestion: 'Compare two approaches or predict an edge case.',
    maxWords: 280,
  },
  11: {
    grade: 11, band: '9-12',
    vocabulary: 'Technical and academic vocabulary; links to math where helpful.',
    sentences: 'Concise, well-structured paragraphs.',
    conceptualizing: 'Concept, mechanism, edge cases, efficiency or design trade-offs.',
    examples: 'Industry and research uses: APIs, data pipelines, AI tools, open source projects.',
    technicalTerms: 'Full technical terms; mention related concepts by name.',
    code: 'Up to 20 lines; note style and edge cases.',
    length: 'About 260 words.',
    checkQuestion: 'Reason about an edge case or design choice.',
    maxWords: 300,
  },
  12: {
    grade: 12, band: '9-12',
    vocabulary: 'College-ready technical vocabulary.',
    sentences: 'Concise, precise paragraphs like an intro college text.',
    conceptualizing: 'Concept, mechanism, formal terms, trade-offs, how it scales, what to learn next.',
    examples: 'Professional and research settings: production systems, ML, security, open source.',
    technicalTerms: 'Formal terminology used precisely, including related concepts.',
    code: 'Up to 20 lines; idiomatic, with a note on complexity or design where relevant.',
    length: 'About 280 words.',
    checkQuestion: 'An open question on trade-offs or extending the idea.',
    maxWords: 320,
  },
}

/** Example themes per concept and grade band, so "loops" sounds different in grade 2 and grade 11. */
export const CONCEPT_EXAMPLES: Record<string, Record<GradeRubric['band'], string>> = {
  variables: {
    'K-2': 'a labeled box or a name tag that holds one thing',
    '3-5': 'a scoreboard that shows the current score',
    '6-8': 'a game character\'s health points that change during play',
    '9-12': 'named references to values in memory, like a user\'s settings in an app',
  },
  loops: {
    'K-2': 'clapping 3 times, or doing the same dance step again and again',
    '3-5': 'running laps around a track until the coach says stop',
    '6-8': 'a game checking every enemy on screen each frame',
    '9-12': 'iterating over records in a dataset, and stopping conditions',
  },
  conditionals: {
    'K-2': 'if it is raining, take an umbrella',
    '3-5': 'if your score is 10, you win the level',
    '6-8': 'an app showing different screens if you are logged in or not',
    '9-12': 'branching logic and boolean expressions in real programs',
  },
  functions: {
    'K-2': 'a recipe card you can use any time you want to make the same snack',
    '3-5': 'a button that always does the same job when you press it',
    '6-8': 'a reusable block in a game, like "jump", that takes how high to jump',
    '9-12': 'parameters, return values and breaking a program into testable parts',
  },
  data: {
    'K-2': 'sorting toys into groups by color',
    '3-5': 'a class chart of favorite fruits',
    '6-8': 'a spreadsheet of sports stats',
    '9-12': 'datasets, tables and what conclusions they can and cannot support',
  },
  ai: {
    'K-2': 'a helper that learns your favorite song by listening many times',
    '3-5': 'a game that gets better at guessing after many tries',
    '6-8': 'a music app suggesting songs from what you played before',
    '9-12': 'models trained on data, their limits, bias and responsible use',
  },
}

export const bandOf = (grade: Grade) => RUBRIC[grade].band

/** The rubric for one grade as instructions for the model. */
export function rubricPrompt(grade: Grade, conceptId?: string | null): string {
  const r = RUBRIC[grade]
  const theme = conceptId ? Object.entries(CONCEPT_EXAMPLES).find(([k]) => conceptId.toLowerCase().includes(k))?.[1][r.band] : undefined
  return [
    `Write for a student in grade ${grade} (band ${r.band}).`,
    `Vocabulary: ${r.vocabulary}`,
    `Sentences: ${r.sentences}`,
    `How to explain: ${r.conceptualizing}`,
    `Examples: ${r.examples}${theme ? ` For this concept, a good example is ${theme}.` : ''}`,
    `Technical terms: ${r.technicalTerms}`,
    `Code: ${r.code}`,
    `Length: ${r.length} Never more than ${r.maxWords} words in the explanation.`,
    `Check question: ${r.checkQuestion}`,
  ].join('\n')
}
