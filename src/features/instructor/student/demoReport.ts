import type { ReportInput } from './report'

// Fictional sample data for demo mode (no database) and for the tests. Every name and number is
// made up. It is shaped so every section of the student page has something to show: a past
// struggle, a slow activity, a strength and a weak concept, and pre/post pairs of every kind.

const mcq = (id: string, prompt: string, conceptId: string, choices: [string, string][]) => ({
  id, type: 'mcq', prompt, conceptId, choices: choices.map(([cid, text]) => ({ id: cid, text })),
})
const answer = (qid: string, choiceId: string) => ({ answers: { [qid]: { choice_id: choiceId } } })

export const DEMO_STUDENT_ID = 'demo-student-ava'

export function demoReportInput(now = new Date(), name = 'Ava K.'): ReportInput {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString()
  const me = DEMO_STUDENT_ID
  return {
    now,
    className: 'Intro to Python (Fall 2026)',
    member: { id: 'demo-seat-ava', displayName: name, profileId: me, claimedAt: ago(12) },
    concepts: [{ id: 'variables', name: 'Variables' }, { id: 'loops', name: 'Loops' }],
    modules: [{
      id: 'm1', title: 'Variables and Loops', position: 0,
      lessons: [
        { id: 'l1', position: 0, title: 'Variables', activities: [
          { id: 'a1', position: 0, kind: 'video', title: 'Watch: what is a variable?', required: true, conceptId: 'variables', content: { embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk' } },
          { id: 'a2', position: 1, kind: 'reading', title: 'Read: naming values', required: true, conceptId: null, content: { body: 'A variable is a name for a value.' } },
          { id: 'a3', position: 2, kind: 'check', title: 'Variables check', required: true, conceptId: 'variables', content: { questions: [
            mcq('q1', 'After x = 3 and then x = x + 2, what is x?', 'variables', [['c1', '3'], ['c2', '5'], ['c3', '32']]),
          ] } },
        ] },
        { id: 'l2', position: 1, title: 'Loops', activities: [
          { id: 'a4', position: 0, kind: 'video', title: 'Watch: for loops', required: true, conceptId: 'loops', content: { embedUrl: 'https://www.youtube-nocookie.com/embed/bcdefghijkl' } },
          { id: 'a5', position: 1, kind: 'worksheet', title: 'Loops worksheet', required: true, conceptId: 'loops', content: { questions: [
            mcq('q2', 'How many times does for i in range(3) run?', 'loops', [['d1', '2'], ['d2', '3'], ['d3', '4']]),
          ] } },
          { id: 'a6', position: 2, kind: 'exit', title: 'Exit question', required: true, conceptId: null, content: { questions: [{ id: 'q3', type: 'reflection', prompt: 'What was hardest today?' }] } },
        ] },
      ],
      tests: [
        { id: 't-pre', kind: 'pre', title: 'Variables and Loops pre-test', items: [
          { id: 'pre1', position: 0, pairKey: 'p1', conceptId: 'variables', content: mcq('r1', 'What does x hold after x = 4? (pre)', 'variables', [['a', '4'], ['b', 'x']]) },
          { id: 'pre2', position: 1, pairKey: 'p2', conceptId: 'loops', content: mcq('r2', 'What does a loop do? (pre)', 'loops', [['a', 'Repeats'], ['b', 'Stops']]) },
          { id: 'pre3', position: 2, pairKey: 'p3', conceptId: 'loops', content: mcq('r3', 'Which keyword starts a loop? (pre)', 'loops', [['a', 'for'], ['b', 'if']]) },
          { id: 'pre4', position: 3, pairKey: 'p4', conceptId: 'loops', content: mcq('r4', 'How many times does range(2) run? (pre)', 'loops', [['a', '2'], ['b', '3']]) },
        ] },
        { id: 't-post', kind: 'post', title: 'Variables and Loops post-test', items: [
          { id: 'post1', position: 0, pairKey: 'p1', conceptId: 'variables', content: mcq('s1', 'What does y hold after y = 7?', 'variables', [['a', '7'], ['b', 'y']]) },
          { id: 'post2', position: 1, pairKey: 'p2', conceptId: 'loops', content: mcq('s2', 'Why use a loop?', 'loops', [['a', 'To repeat steps'], ['b', 'To stop']]) },
          { id: 'post3', position: 2, pairKey: 'p3', conceptId: 'loops', content: mcq('s3', 'Which keyword repeats code?', 'loops', [['a', 'for'], ['b', 'if']]) },
          { id: 'post4', position: 3, pairKey: 'p4', conceptId: 'loops', content: mcq('s4', 'How many times does range(4) run?', 'loops', [['a', '4'], ['b', '5']]) },
        ] },
      ],
    }],
    progress: [
      { activityId: 'a1', status: 'completed', bestScore: 0, timeSpentS: 240, startedAt: ago(10), updatedAt: ago(10), completedAt: ago(10) },
      { activityId: 'a2', status: 'completed', bestScore: 0, timeSpentS: 180, startedAt: ago(9), updatedAt: ago(9), completedAt: ago(9) },
      { activityId: 'a3', status: 'completed', bestScore: 100, timeSpentS: 300, startedAt: ago(9), updatedAt: ago(8), completedAt: ago(8) },
      { activityId: 'a4', status: 'completed', bestScore: 0, timeSpentS: 260, startedAt: ago(7), updatedAt: ago(7), completedAt: ago(7) },
      { activityId: 'a5', status: 'completed', bestScore: 100, timeSpentS: 900, startedAt: ago(6), updatedAt: ago(5), completedAt: ago(5) },
      { activityId: 'a6', status: 'in_progress', bestScore: 0, timeSpentS: 60, startedAt: ago(4), updatedAt: ago(4), completedAt: null },
    ],
    classProgress: [
      { studentId: me, activityId: 'a5', timeSpentS: 900 },
      { studentId: 's2', activityId: 'a5', timeSpentS: 300 },
      { studentId: 's3', activityId: 'a5', timeSpentS: 360 },
      { studentId: 's4', activityId: 'a5', timeSpentS: 420 },
      { studentId: 's2', activityId: 'a3', timeSpentS: 280 },
      { studentId: 's3', activityId: 'a3', timeSpentS: 320 },
    ],
    submissions: [
      { activityId: 'a3', response: answer('q1', 'c1'), isCorrect: false, results: { q1: { correct: false, concept: 'variables' } }, attemptNo: 1, submittedAt: ago(9) },
      { activityId: 'a3', response: answer('q1', 'c2'), isCorrect: true, results: { q1: { correct: true, concept: 'variables' } }, attemptNo: 2, submittedAt: ago(8) },
      { activityId: 'a5', response: answer('q2', 'd1'), isCorrect: false, results: { q2: { correct: false, concept: 'loops' } }, attemptNo: 1, submittedAt: ago(6) },
      { activityId: 'a5', response: answer('q2', 'd1'), isCorrect: false, results: { q2: { correct: false, concept: 'loops' } }, attemptNo: 2, submittedAt: ago(6) },
      { activityId: 'a5', response: answer('q2', 'd3'), isCorrect: false, results: { q2: { correct: false, concept: 'loops' } }, attemptNo: 3, submittedAt: ago(5) },
      { activityId: 'a5', response: answer('q2', 'd2'), isCorrect: true, results: { q2: { correct: true, concept: 'loops' } }, attemptNo: 4, submittedAt: ago(5) },
      { activityId: 'a1', response: { viewed: true }, isCorrect: null, results: {}, attemptNo: 1, submittedAt: ago(10) },
    ],
    testResults: [
      { assessmentId: 't-pre', scorePct: 50, submittedAt: ago(11) },
      { assessmentId: 't-post', scorePct: 75, submittedAt: ago(4) },
    ],
    testResponses: [
      { itemId: 'pre1', isCorrect: true }, { itemId: 'pre2', isCorrect: false }, { itemId: 'pre3', isCorrect: true }, { itemId: 'pre4', isCorrect: false },
      { itemId: 'post1', isCorrect: false }, { itemId: 'post2', isCorrect: true }, { itemId: 'post3', isCorrect: true }, { itemId: 'post4', isCorrect: true },
    ],
    hints: [
      { activityId: 'a5', conceptId: 'loops', createdAt: ago(6) },
      { activityId: 'a5', conceptId: 'loops', createdAt: ago(5) },
      { activityId: 'a3', conceptId: 'variables', createdAt: ago(9) },
    ],
    mastery: [
      { studentId: me, conceptId: 'variables', attempts: 2, masteryPct: 90 },
      { studentId: me, conceptId: 'loops', attempts: 4, masteryPct: 45 },
      { studentId: 's2', conceptId: 'variables', attempts: 2, masteryPct: 70 },
      { studentId: 's3', conceptId: 'variables', attempts: 2, masteryPct: 80 },
      { studentId: 's4', conceptId: 'variables', attempts: 3, masteryPct: 60 },
      { studentId: 's2', conceptId: 'loops', attempts: 3, masteryPct: 75 },
      { studentId: 's3', conceptId: 'loops', attempts: 2, masteryPct: 80 },
      { studentId: 's4', conceptId: 'loops', attempts: 4, masteryPct: 70 },
    ],
    gain: [
      { scope: 'student', studentId: me, moduleId: 'm1', conceptId: null, prePct: 50, postPct: 75, gainPoints: 25, normalizedGain: 0.5, status: 'complete' },
      { scope: 'student', studentId: me, moduleId: 'm1', conceptId: 'variables', prePct: 100, postPct: 0, gainPoints: -100, normalizedGain: null, status: 'complete' },
      { scope: 'student', studentId: me, moduleId: 'm1', conceptId: 'loops', prePct: 33.33, postPct: 100, gainPoints: 66.67, normalizedGain: 1, status: 'complete' },
      { scope: 'class', studentId: null, moduleId: 'm1', conceptId: null, prePct: 30, postPct: 60, gainPoints: 30, normalizedGain: 0.43, status: 'complete' },
    ],
    stuck: [],
    classCompletion: [
      { studentId: me, completionPct: 83.33, joined: true },
      { studentId: 's2', completionPct: 100, joined: true },
      { studentId: 's3', completionPct: 80, joined: true },
      { studentId: 's4', completionPct: 60, joined: true },
      { studentId: null, completionPct: 0, joined: false },
    ],
  }
}
