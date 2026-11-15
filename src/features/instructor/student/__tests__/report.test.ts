import { describe, expect, it } from 'vitest'
import { DEMO_STUDENT_ID, demoReportInput } from '../demoReport'
import { buildStudentReport, dayKey, median, type ReportInput } from '../report'

// A fixed "now" (local noon) so day counts and the calendar are stable.
const NOW = new Date(2026, 10, 15, 12, 0, 0)
const build = (change: (i: ReportInput) => void = () => {}) => {
  const input = demoReportInput(NOW)
  change(input)
  return buildStudentReport(input)
}

describe('helpers', () => {
  it('median of odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('dayKey is the local calendar date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('progress and status', () => {
  const r = build()

  it('counts required activities done, against the class median (excluding this student)', () => {
    expect(r.completion).toEqual({ required: 6, completed: 5, pct: 83, classMedianPct: 80 })
    expect(r.modules[0]).toMatchObject({ title: 'Variables and Loops', required: 6, completed: 5, pct: 83 })
  })

  it('finds where the student is now: the first required activity not done', () => {
    expect(r.current).toEqual({ module: 'Variables and Loops', lesson: 'Loops', activity: 'Exit question', kind: 'exit' })
  })

  it('knows the last activity and calls 3 or more quiet days inactive', () => {
    expect(r.daysSinceActive).toBe(4)
    expect(r.status).toEqual({ kind: 'inactive', label: 'No activity for 4 days' })
  })

  it('reads each activity: state, attempts, first try, hints and time against the class', () => {
    const rows = r.modules[0].lessons.flatMap((l) => l.activities)
    const check = rows.find((a) => a.id === 'a3')!
    expect(check).toMatchObject({ state: 'completed', attempts: 2, firstTryCorrect: false, hints: 1, bestScore: 100, classMedianTimeS: 300, concept: 'Variables' })
    const sheet = rows.find((a) => a.id === 'a5')!
    expect(sheet).toMatchObject({ attempts: 4, firstTryCorrect: false, hints: 2, timeSpentS: 900, classMedianTimeS: 360 })
    const video = rows.find((a) => a.id === 'a1')!
    expect(video).toMatchObject({ attempts: 0, firstTryCorrect: null, bestScore: null })
    expect(rows.find((a) => a.id === 'a6')!.state).toBe('in_progress')
  })
})

describe('learning gain and pre/post pairs', () => {
  const r = build()

  it('takes the ADR 0020 numbers from the view, with the class gain beside them', () => {
    expect(r.gain[0]).toMatchObject({ module: 'Variables and Loops', prePct: 50, postPct: 75, gainPoints: 25, normalizedGain: 0.5, complete: true, classGainPoints: 30 })
    expect(r.gain[0].concepts.map((c) => c.concept)).toEqual(['Loops', 'Variables'])
  })

  it('classifies every pre/post question pair', () => {
    const outcome = Object.fromEntries(r.pairs.map((p) => [p.pairKey, p.outcome]))
    expect(outcome).toEqual({ p1: 'slipped', p2: 'learned', p3: 'kept', p4: 'learned' })
    expect(r.pairCounts).toEqual({ learned: 2, kept: 1, missing: 0, slipped: 1, incomplete: 0 })
    expect(r.pairs[0]).toMatchObject({ concept: 'Variables', prompt: 'What does y hold after y = 7?' })
  })

  it('marks a pair incomplete when either answer is missing, never as wrong', () => {
    const r2 = build((i) => { i.testResponses = i.testResponses.filter((x) => x.itemId !== 'post4') })
    expect(r2.pairs.find((p) => p.pairKey === 'p4')).toMatchObject({ pre: false, post: null, outcome: 'incomplete' })
  })
})

describe('concept mastery against the class', () => {
  it('finds strengths and concepts to focus on, weakest first', () => {
    const r = build()
    expect(r.mastery).toEqual([
      { concept: 'Loops', masteryPct: 45, attempts: 4, classAvgPct: 75, band: 'focus' },
      { concept: 'Variables', masteryPct: 90, attempts: 2, classAvgPct: 70, band: 'strength' },
    ])
  })
})

describe('accuracy', () => {
  const r = build()

  it('counts scored attempts only (a viewed video is not an attempt)', () => {
    expect(r.accuracy).toMatchObject({ scoredActivities: 2, totalAttempts: 6, wrongAttempts: 4, firstTryPct: 0 })
  })

  it('lists the most-missed activities', () => {
    expect(r.accuracy.mostMissed).toEqual([
      { activity: 'Loops worksheet', wrong: 3, attempts: 4, solved: true },
      { activity: 'Variables check', wrong: 1, attempts: 2, solved: true },
    ])
  })

  it('finds repeated wrong choices, using the choice text a student saw', () => {
    expect(r.accuracy.wrongChoices[0]).toEqual({ activity: 'Loops worksheet', prompt: 'How many times does for i in range(3) run?', choice: '2', times: 2 })
    expect(r.accuracy.wrongChoices.map((w) => w.choice).sort()).toEqual(['2', '3', '4'])
  })
})

describe('engagement and hints', () => {
  const r = build()

  it('adds up time on task and active days, with a 4-week calendar ending today', () => {
    expect(r.engagement.totalTimeS).toBe(1940)
    expect(r.engagement.activeDays).toBe(8)
    expect(r.engagement.longestStreak).toBe(8)
    expect(r.engagement.calendar).toHaveLength(28)
    expect(r.engagement.calendar.at(-1)!.date).toBe(dayKey(NOW))
  })

  it('calls out an activity that took over twice the class median', () => {
    expect(r.engagement.slowActivities).toEqual([{ activity: 'Loops worksheet', timeS: 900, classMedianS: 360 }])
  })

  it('counts hints by concept and activity, and per scored try', () => {
    expect(r.hints.total).toBe(3)
    expect(r.hints.byConcept).toEqual([{ concept: 'Loops', count: 2 }, { concept: 'Variables', count: 1 }])
    expect(r.hints.byActivity[0]).toEqual({ activity: 'Loops worksheet', count: 2 })
    expect(r.hints.perScoredAttempt).toBe(0.5)
  })

  it('lists past struggles (3 or more wrong tries)', () => {
    expect(r.struggles).toEqual({ current: [], past: [{ activity: 'Loops worksheet', wrong: 3, solved: true }] })
  })
})

describe('next steps and the note draft', () => {
  it('puts the most urgent first and explains each one', () => {
    const r = build()
    expect(r.nextSteps.map((s) => s.severity)).toEqual(['high', 'medium', 'medium', 'info'])
    expect(r.nextSteps[0].text).toMatch(/No activity for 4 days/)
    expect(r.nextSteps[1].text).toBe('Review Loops: mastery 45% against 75% for the class.')
    expect(r.nextSteps[2].text).toMatch(/post-test question wrong after getting it right.*Variables/)
    expect(r.nextSteps[3].text).toMatch(/Strong in Variables/)
  })

  it('drafts a short note for the instructor to send themselves', () => {
    expect(build().noteDraft).toBe(
      "Hi Ava, you have finished 83% of your work in Intro to Python (Fall 2026). Great work on Variables. Next, let's practice Loops together. Ask me any time you get stuck.",
    )
  })

  it('handles a seat nobody has claimed yet', () => {
    const r = build((i) => {
      i.member.profileId = null
      i.progress = []; i.submissions = []; i.testResults = []; i.testResponses = []; i.hints = []
      i.gain = i.gain.filter((g) => g.scope === 'class')
      i.mastery = i.mastery.filter((m) => m.studentId !== DEMO_STUDENT_ID)
    })
    expect(r.status.kind).toBe('not_joined')
    expect(r.nextSteps).toHaveLength(1)
    expect(r.nextSteps[0].text).toMatch(/Has not signed in yet/)
    expect(r.noteDraft).toMatch(/here is your login card/)
  })

  it('handles a student who signed in but has not started', () => {
    const r = build((i) => { i.progress = []; i.submissions = []; i.testResults = []; i.testResponses = []; i.hints = [] })
    expect(r.status.kind).toBe('not_started')
    expect(r.nextSteps[0]).toEqual({ severity: 'high', text: 'Signed in but has not started. Check they can open the first activity.' })
  })

  it('names the activity and the reasons when a student is stuck now', () => {
    const r = build((i) => { i.stuck = [{ activityId: 'a6', wrongAttempts: 3, minutesOnActivity: 12, daysInactive: 0, reasons: ['wrong_attempts', 'long_time'] }] })
    expect(r.status.kind).toBe('stuck')
    expect(r.struggles.current).toEqual([{ activity: 'Exit question', reasons: ['3 wrong tries', '12 minutes on one activity'] }])
    expect(r.nextSteps[0].text).toBe('Stuck on "Exit question" (3 wrong tries, 12 minutes on one activity). Check in with them today.')
  })

  it('says a recent student who finished everything is done', () => {
    const r = build((i) => {
      i.progress = i.progress.map((p) => ({ ...p, status: 'completed' as const, completedAt: p.completedAt ?? p.updatedAt, updatedAt: new Date(NOW.getTime() - 3_600_000).toISOString() }))
    })
    expect(r.status.kind).toBe('done')
    expect(r.current).toBeNull()
  })
})
