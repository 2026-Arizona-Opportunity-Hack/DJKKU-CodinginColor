// The per-student report: turns one student's raw rows into every number the student page
// shows. Pure (no database, no React, no clock unless passed in), so each metric is unit-tested.
// Every rule here is rule-based on purpose (mentor guidance: no ML for the MVP), and every
// threshold is a named constant so it is easy to find and change once CIC confirms them.

// One list of activity kinds for the whole app (it gained `code`); a second copy here broke this page.
export type { ActivityKind } from '@shared/authoring/schemas'
import type { ActivityKind } from '@shared/authoring/schemas'

export interface ReportActivity {
  id: string
  position: number
  kind: ActivityKind
  title: string
  required: boolean
  conceptId: string | null
  content: unknown
}
export interface ReportLesson { id: string; position: number; title: string; activities: ReportActivity[] }
export interface ReportTestItem { id: string; position: number; pairKey: string; conceptId: string; content: unknown }
export interface ReportTest { id: string; kind: 'pre' | 'post'; title: string; items: ReportTestItem[] }
export interface ReportModule { id: string; title: string; position: number; lessons: ReportLesson[]; tests: ReportTest[] }

export interface ReportInput {
  now: Date
  className: string
  member: { id: string; displayName: string; profileId: string | null; claimedAt: string | null }
  concepts: { id: string; name: string }[]
  /** Modules assigned to the class, in class order. */
  modules: ReportModule[]
  /** This student's progress rows. */
  progress: {
    activityId: string
    status: 'in_progress' | 'completed'
    bestScore: number
    timeSpentS: number
    startedAt: string
    updatedAt: string
    completedAt: string | null
  }[]
  /** Everyone's time per activity in this class, for the "compared with the class" numbers. */
  classProgress: { studentId: string; activityId: string; timeSpentS: number }[]
  submissions: {
    activityId: string
    response: unknown
    isCorrect: boolean | null
    results: Record<string, { correct?: boolean; concept?: string | null }>
    attemptNo: number
    submittedAt: string
  }[]
  testResults: { assessmentId: string; scorePct: number; submittedAt: string }[]
  testResponses: { itemId: string; isCorrect: boolean }[]
  hints: { activityId: string; conceptId: string | null; createdAt: string }[]
  /** Concept mastery for every student in the class (v_concept_mastery). */
  mastery: { studentId: string; conceptId: string; attempts: number; masteryPct: number }[]
  /** This student's learning-gain rows plus the class rows (v_learning_gain). */
  gain: {
    scope: 'student' | 'class'
    studentId: string | null
    moduleId: string
    conceptId: string | null
    prePct: number | null
    postPct: number | null
    gainPoints: number | null
    normalizedGain: number | null
    status: 'complete' | 'incomplete'
  }[]
  /** This student's rows in v_stuck. */
  stuck: { activityId: string | null; wrongAttempts: number; minutesOnActivity: number; daysInactive: number; reasons: string[] }[]
  /** Completion for everyone in the class (v_class_progress). */
  classCompletion: { studentId: string | null; completionPct: number; joined: boolean }[]
}

// ---------- thresholds (defaults; CIC has not confirmed them) ----------

/** Days with no activity before a student counts as inactive (calendar days). */
export const INACTIVE_DAYS = 3
/** Points behind the class median completion before we call it out. */
export const BEHIND_POINTS = 25
/** Mastery at or below this, or this far under the class, is a concept to focus on. */
export const FOCUS_MASTERY = 60
export const FOCUS_BELOW_CLASS = 15
/** Mastery at or above this, and not below the class, is a strength. */
export const STRONG_MASTERY = 80
/** Wrong tries on one activity that count as a past struggle. */
export const STRUGGLE_WRONG = 3
/** Taking this many times the class median on an activity is called out. */
export const SLOW_FACTOR = 2
/** Days shown in the activity calendar. */
export const CALENDAR_DAYS = 28

// ---------- output ----------

export type StatusKind = 'not_joined' | 'not_started' | 'stuck' | 'inactive' | 'done' | 'on_track'
export type ActivityState = 'completed' | 'in_progress' | 'not_started'
export type PairOutcome = 'learned' | 'kept' | 'missing' | 'slipped' | 'incomplete'

export interface ActivityRow {
  id: string
  title: string
  kind: ActivityKind
  required: boolean
  concept: string | null
  state: ActivityState
  bestScore: number | null
  timeSpentS: number
  classMedianTimeS: number | null
  attempts: number
  firstTryCorrect: boolean | null
  hints: number
}

export interface StudentReport {
  name: string
  className: string
  joined: boolean
  joinedAt: string | null
  lastActiveAt: string | null
  daysSinceActive: number | null
  status: { kind: StatusKind; label: string }
  completion: { required: number; completed: number; pct: number; classMedianPct: number | null }
  current: { module: string; lesson: string; activity: string; kind: ActivityKind } | null
  modules: {
    id: string
    title: string
    required: number
    completed: number
    pct: number
    lessons: { id: string; title: string; activities: ActivityRow[] }[]
  }[]
  gain: {
    moduleId: string
    module: string
    prePct: number | null
    postPct: number | null
    gainPoints: number | null
    normalizedGain: number | null
    complete: boolean
    classGainPoints: number | null
    concepts: { concept: string; prePct: number | null; postPct: number | null; gainPoints: number | null }[]
  }[]
  pairs: { module: string; pairKey: string; concept: string; prompt: string; pre: boolean | null; post: boolean | null; outcome: PairOutcome }[]
  pairCounts: Record<PairOutcome, number>
  mastery: { concept: string; masteryPct: number; attempts: number; classAvgPct: number | null; band: 'strength' | 'ok' | 'focus' }[]
  accuracy: {
    scoredActivities: number
    totalAttempts: number
    wrongAttempts: number
    firstTryPct: number | null
    mostMissed: { activity: string; wrong: number; attempts: number; solved: boolean }[]
    wrongChoices: { activity: string; prompt: string; choice: string; times: number }[]
  }
  engagement: {
    totalTimeS: number
    activeDays: number
    longestStreak: number
    firstActiveAt: string | null
    calendar: { date: string; count: number }[]
    slowActivities: { activity: string; timeS: number; classMedianS: number }[]
  }
  hints: { total: number; byConcept: { concept: string; count: number }[]; byActivity: { activity: string; count: number }[]; perScoredAttempt: number | null }
  struggles: { current: { activity: string; reasons: string[] }[]; past: { activity: string; wrong: number; solved: boolean }[] }
  tests: { id: string; module: string; kind: 'pre' | 'post'; title: string; scorePct: number | null; submittedAt: string | null }[]
  nextSteps: { severity: 'high' | 'medium' | 'info'; text: string }[]
  noteDraft: string
}

// ---------- helpers ----------

const DAY_MS = 86_400_000

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const round = (n: number) => Math.round(n)

/** Local calendar date, YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

interface QuestionLike { id: string; type: string; prompt: string; choices: { id: string; text: string }[] }

/** Questions inside an activity's or a test item's content, read defensively (content is jsonb). */
function questionsOf(content: unknown): QuestionLike[] {
  const raw = (content as { questions?: unknown })?.questions
  const list = Array.isArray(raw) ? raw : content && typeof content === 'object' && 'prompt' in content ? [content] : []
  return list.flatMap((q) => {
    if (!q || typeof q !== 'object') return []
    const o = q as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.prompt !== 'string' || typeof o.type !== 'string') return []
    const choices = Array.isArray(o.choices)
      ? o.choices.flatMap((c) => (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string' && typeof (c as { text?: unknown }).text === 'string' ? [c as { id: string; text: string }] : []))
      : []
    return [{ id: o.id, type: o.type, prompt: o.prompt, choices }]
  })
}

function chosenChoice(response: unknown, questionId: string): string | null {
  const answers = (response as { answers?: Record<string, unknown> })?.answers
  const a = answers?.[questionId] as { choice_id?: unknown } | undefined
  return typeof a?.choice_id === 'string' ? a.choice_id : null
}

const STUCK_LABEL = (s: ReportInput['stuck'][number]) =>
  s.reasons.map((r) =>
    r === 'wrong_attempts'
      ? `${s.wrongAttempts} wrong tries`
      : r === 'long_time'
        ? `${round(s.minutesOnActivity)} minutes on one activity`
        : `${s.daysInactive} school days without activity`,
  )

// ---------- the report ----------

export function buildStudentReport(input: ReportInput): StudentReport {
  const conceptName = new Map(input.concepts.map((c) => [c.id, c.name]))
  const nameOf = (id: string | null) => (id ? (conceptName.get(id) ?? id) : null)
  const studentId = input.member.profileId
  const joined = studentId !== null

  const activities = input.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.activities.map((a) => ({ module: m, lesson: l, activity: a }))),
  )
  const activityTitle = new Map(activities.map((x) => [x.activity.id, x.activity.title]))
  const titleOf = (id: string | null) => (id ? (activityTitle.get(id) ?? 'An activity') : 'No recent activity')

  const progressBy = new Map(input.progress.map((p) => [p.activityId, p]))
  const subsBy = new Map<string, ReportInput['submissions']>()
  for (const s of input.submissions) subsBy.set(s.activityId, [...(subsBy.get(s.activityId) ?? []), s])
  const hintsBy = new Map<string, number>()
  for (const h of input.hints) hintsBy.set(h.activityId, (hintsBy.get(h.activityId) ?? 0) + 1)

  const classTimes = new Map<string, number[]>()
  for (const p of input.classProgress) {
    if (p.studentId === studentId || p.timeSpentS <= 0) continue
    classTimes.set(p.activityId, [...(classTimes.get(p.activityId) ?? []), p.timeSpentS])
  }

  // Activity rows, in class order.
  const rowFor = (a: ReportActivity): ActivityRow => {
    const p = progressBy.get(a.id)
    const subs = [...(subsBy.get(a.id) ?? [])].sort((x, y) => x.attemptNo - y.attemptNo)
    const scored = subs.filter((s) => s.isCorrect !== null)
    return {
      id: a.id,
      title: a.title,
      kind: a.kind,
      required: a.required,
      concept: nameOf(a.conceptId),
      state: p?.status === 'completed' ? 'completed' : p ? 'in_progress' : 'not_started',
      bestScore: p && scored.length ? p.bestScore : null,
      timeSpentS: p?.timeSpentS ?? 0,
      classMedianTimeS: median(classTimes.get(a.id) ?? []),
      attempts: scored.length,
      firstTryCorrect: scored.length ? scored[0].isCorrect === true : null,
      hints: hintsBy.get(a.id) ?? 0,
    }
  }

  const modules = input.modules.map((m) => {
    const lessons = m.lessons.map((l) => ({ id: l.id, title: l.title, activities: l.activities.map(rowFor) }))
    const required = lessons.flatMap((l) => l.activities).filter((a) => a.required)
    const completed = required.filter((a) => a.state === 'completed').length
    return { id: m.id, title: m.title, required: required.length, completed, pct: required.length ? round((completed / required.length) * 100) : 0, lessons }
  })

  const required = modules.reduce((n, m) => n + m.required, 0)
  const completed = modules.reduce((n, m) => n + m.completed, 0)
  const classMedianPct = median(input.classCompletion.filter((c) => c.joined && c.studentId !== studentId).map((c) => c.completionPct))
  const completion = { required, completed, pct: required ? round((completed / required) * 100) : 0, classMedianPct: classMedianPct === null ? null : round(classMedianPct) }

  const currentHit = activities.find((x) => x.activity.required && progressBy.get(x.activity.id)?.status !== 'completed')
  const current = currentHit
    ? { module: currentHit.module.title, lesson: currentHit.lesson.title, activity: currentHit.activity.title, kind: currentHit.activity.kind }
    : null

  // Activity timestamps: for last active, active days and the calendar.
  const stamps = [
    ...input.submissions.map((s) => s.submittedAt),
    ...input.testResults.map((t) => t.submittedAt),
    ...input.hints.map((h) => h.createdAt),
    ...input.progress.flatMap((p) => [p.startedAt, p.updatedAt, ...(p.completedAt ? [p.completedAt] : [])]),
  ]
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  const lastActive = stamps.at(-1) ?? null
  const daysSinceActive = lastActive ? Math.max(0, Math.floor((input.now.getTime() - lastActive.getTime()) / DAY_MS)) : null

  // Status.
  const started = input.progress.length > 0 || input.submissions.length > 0 || input.testResults.length > 0
  const status: StudentReport['status'] = !joined
    ? { kind: 'not_joined', label: 'Has not signed in yet' }
    : !started
      ? { kind: 'not_started', label: 'Not started' }
      : input.stuck.length > 0
        ? { kind: 'stuck', label: 'Stuck now' }
        : daysSinceActive !== null && daysSinceActive >= INACTIVE_DAYS
          ? { kind: 'inactive', label: `No activity for ${daysSinceActive} days` }
          : required > 0 && completed === required
            ? { kind: 'done', label: 'Finished all assigned work' }
            : { kind: 'on_track', label: 'On track' }

  // Learning gain (ADR 0020 numbers straight from the view; we only arrange them).
  const mine = input.gain.filter((g) => g.scope === 'student' && g.studentId === studentId)
  const gain = input.modules
    .map((m) => {
      const overall = mine.find((g) => g.moduleId === m.id && g.conceptId === null)
      const cls = input.gain.find((g) => g.scope === 'class' && g.moduleId === m.id && g.conceptId === null)
      return {
        moduleId: m.id,
        module: m.title,
        prePct: overall?.prePct ?? null,
        postPct: overall?.postPct ?? null,
        gainPoints: overall?.gainPoints ?? null,
        normalizedGain: overall?.normalizedGain ?? null,
        complete: overall?.status === 'complete',
        classGainPoints: cls?.gainPoints ?? null,
        concepts: mine
          .filter((g) => g.moduleId === m.id && g.conceptId !== null)
          .map((g) => ({ concept: nameOf(g.conceptId) ?? '', prePct: g.prePct, postPct: g.postPct, gainPoints: g.gainPoints }))
          .sort((a, b) => a.concept.localeCompare(b.concept)),
      }
    })
    .filter((g) => g.prePct !== null || g.postPct !== null || moduleHasTests(input, g.moduleId))

  // Item-level pre/post pairs: which questions they learned, kept, still miss, or slipped on.
  const correctByItem = new Map(input.testResponses.map((r) => [r.itemId, r.isCorrect]))
  const pairs: StudentReport['pairs'] = []
  for (const m of input.modules) {
    const pre = m.tests.find((t) => t.kind === 'pre')
    const post = m.tests.find((t) => t.kind === 'post')
    if (!pre || !post) continue
    for (const item of [...pre.items].sort((a, b) => a.position - b.position)) {
      const twin = post.items.find((i) => i.pairKey === item.pairKey)
      if (!twin) continue
      const a = correctByItem.get(item.id) ?? null
      const b = correctByItem.get(twin.id) ?? null
      const outcome: PairOutcome = a === null || b === null ? 'incomplete' : !a && b ? 'learned' : a && b ? 'kept' : !a && !b ? 'missing' : 'slipped'
      pairs.push({ module: m.title, pairKey: item.pairKey, concept: nameOf(item.conceptId) ?? item.conceptId, prompt: questionsOf(twin.content)[0]?.prompt ?? '', pre: a, post: b, outcome })
    }
  }
  const pairCounts: Record<PairOutcome, number> = { learned: 0, kept: 0, missing: 0, slipped: 0, incomplete: 0 }
  for (const p of pairs) pairCounts[p.outcome] += 1

  // Concept mastery against the class.
  const classMastery = new Map<string, number[]>()
  for (const r of input.mastery) classMastery.set(r.conceptId, [...(classMastery.get(r.conceptId) ?? []), r.masteryPct])
  const mastery = input.mastery
    .filter((r) => r.studentId === studentId)
    .map((r) => {
      const others = input.mastery.filter((o) => o.conceptId === r.conceptId && o.studentId !== studentId).map((o) => o.masteryPct)
      const classAvgPct = others.length ? round(others.reduce((a, b) => a + b, 0) / others.length) : null
      const pct = round(r.masteryPct)
      const band: 'strength' | 'ok' | 'focus' =
        pct <= FOCUS_MASTERY || (classAvgPct !== null && pct <= classAvgPct - FOCUS_BELOW_CLASS)
          ? 'focus'
          : pct >= STRONG_MASTERY && (classAvgPct === null || pct >= classAvgPct)
            ? 'strength'
            : 'ok'
      return { concept: nameOf(r.conceptId) ?? r.conceptId, masteryPct: pct, attempts: r.attempts, classAvgPct, band }
    })
    .sort((a, b) => a.masteryPct - b.masteryPct)

  // Accuracy.
  const rows = modules.flatMap((m) => m.lessons.flatMap((l) => l.activities))
  const scoredRows = rows.filter((r) => r.attempts > 0)
  const scoredSubs = input.submissions.filter((s) => s.isCorrect !== null)
  const wrongAttempts = scoredSubs.filter((s) => s.isCorrect === false).length
  const firstTries = scoredRows.filter((r) => r.firstTryCorrect !== null)
  const missed = scoredRows
    .map((r) => {
      const subs = (subsBy.get(r.id) ?? []).filter((s) => s.isCorrect !== null)
      return { activity: r.title, wrong: subs.filter((s) => s.isCorrect === false).length, attempts: subs.length, solved: subs.some((s) => s.isCorrect === true) }
    })
    .filter((m) => m.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.activity.localeCompare(b.activity))

  const choiceCounts = new Map<string, { activity: string; prompt: string; choice: string; times: number }>()
  for (const s of input.submissions) {
    const act = activities.find((x) => x.activity.id === s.activityId)?.activity
    if (!act) continue
    for (const q of questionsOf(act.content)) {
      if (q.type !== 'mcq' || s.results?.[q.id]?.correct !== false) continue
      const picked = chosenChoice(s.response, q.id)
      const text = q.choices.find((c) => c.id === picked)?.text
      if (!picked || !text) continue
      const key = `${act.id}|${q.id}|${picked}`
      const prev = choiceCounts.get(key)
      choiceCounts.set(key, { activity: act.title, prompt: q.prompt, choice: text, times: (prev?.times ?? 0) + 1 })
    }
  }

  const accuracy: StudentReport['accuracy'] = {
    scoredActivities: scoredRows.length,
    totalAttempts: scoredSubs.length,
    wrongAttempts,
    firstTryPct: firstTries.length ? round((firstTries.filter((r) => r.firstTryCorrect).length / firstTries.length) * 100) : null,
    mostMissed: missed.slice(0, 5),
    wrongChoices: [...choiceCounts.values()].sort((a, b) => b.times - a.times).slice(0, 5),
  }

  // Engagement: time on task, active days, a 4-week calendar, and unusually slow activities.
  const days = new Map<string, number>()
  for (const d of stamps) days.set(dayKey(d), (days.get(dayKey(d)) ?? 0) + 1)
  const calendar: { date: string; count: number }[] = []
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
    const d = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() - i)
    calendar.push({ date: dayKey(d), count: days.get(dayKey(d)) ?? 0 })
  }
  let longestStreak = 0
  let run = 0
  for (const c of calendar) {
    run = c.count > 0 ? run + 1 : 0
    longestStreak = Math.max(longestStreak, run)
  }
  const engagement: StudentReport['engagement'] = {
    totalTimeS: input.progress.reduce((n, p) => n + p.timeSpentS, 0),
    activeDays: days.size,
    longestStreak,
    firstActiveAt: stamps[0]?.toISOString() ?? null,
    calendar,
    slowActivities: rows
      .filter((r) => r.classMedianTimeS !== null && r.classMedianTimeS > 0 && r.timeSpentS >= r.classMedianTimeS * SLOW_FACTOR)
      .map((r) => ({ activity: r.title, timeS: r.timeSpentS, classMedianS: r.classMedianTimeS as number }))
      .sort((a, b) => b.timeS / b.classMedianS - a.timeS / a.classMedianS),
  }

  // Hints.
  const byConcept = new Map<string, number>()
  for (const h of input.hints) {
    const c = nameOf(h.conceptId) ?? 'No concept'
    byConcept.set(c, (byConcept.get(c) ?? 0) + 1)
  }
  const hints: StudentReport['hints'] = {
    total: input.hints.length,
    byConcept: [...byConcept.entries()].map(([concept, count]) => ({ concept, count })).sort((a, b) => b.count - a.count),
    byActivity: [...hintsBy.entries()].map(([id, count]) => ({ activity: titleOf(id), count })).sort((a, b) => b.count - a.count),
    perScoredAttempt: scoredSubs.length ? Math.round((input.hints.length / scoredSubs.length) * 100) / 100 : null,
  }

  const struggles: StudentReport['struggles'] = {
    current: input.stuck.map((s) => ({ activity: titleOf(s.activityId), reasons: STUCK_LABEL(s) })),
    past: missed.filter((m) => m.wrong >= STRUGGLE_WRONG).map((m) => ({ activity: m.activity, wrong: m.wrong, solved: m.solved })),
  }

  const resultBy = new Map(input.testResults.map((t) => [t.assessmentId, t]))
  const tests = input.modules.flatMap((m) =>
    [...m.tests]
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'pre' ? -1 : 1))
      .map((t) => ({ id: t.id, module: m.title, kind: t.kind, title: t.title, scorePct: resultBy.get(t.id)?.scorePct ?? null, submittedAt: resultBy.get(t.id)?.submittedAt ?? null })),
  )

  const report: StudentReport = {
    name: input.member.displayName,
    className: input.className,
    joined,
    joinedAt: input.member.claimedAt,
    lastActiveAt: lastActive?.toISOString() ?? null,
    daysSinceActive,
    status,
    completion,
    current,
    modules,
    gain,
    pairs,
    pairCounts,
    mastery,
    accuracy,
    engagement,
    hints,
    struggles,
    tests,
    nextSteps: [],
    noteDraft: '',
  }
  report.nextSteps = nextSteps(report)
  report.noteDraft = noteDraft(report)
  return report
}

function moduleHasTests(input: ReportInput, moduleId: string): boolean {
  return input.modules.some((m) => m.id === moduleId && m.tests.length > 0)
}

/** Rule-based suggestions for the instructor, most urgent first. */
export function nextSteps(r: StudentReport): StudentReport['nextSteps'] {
  const out: StudentReport['nextSteps'] = []
  if (r.status.kind === 'not_joined') {
    out.push({ severity: 'high', text: 'Has not signed in yet. Give them their login card, or reset their code below.' })
    return out
  }
  if (r.status.kind === 'not_started') out.push({ severity: 'high', text: 'Signed in but has not started. Check they can open the first activity.' })
  for (const s of r.struggles.current) out.push({ severity: 'high', text: `Stuck on "${s.activity}" (${s.reasons.join(', ')}). Check in with them today.` })
  if (r.status.kind === 'inactive') out.push({ severity: 'high', text: `${r.status.label}. Reach out to see what is in the way.` })
  if (r.completion.classMedianPct !== null && r.completion.pct <= r.completion.classMedianPct - BEHIND_POINTS) {
    out.push({ severity: 'medium', text: `Behind the class: ${r.completion.pct}% done against a class median of ${r.completion.classMedianPct}%.` })
  }
  for (const m of r.mastery.filter((x) => x.band === 'focus')) {
    out.push({ severity: 'medium', text: `Review ${m.concept}: mastery ${m.masteryPct}%${m.classAvgPct !== null ? ` against ${m.classAvgPct}% for the class` : ''}.` })
  }
  if (r.pairCounts.slipped > 0) {
    const concepts = [...new Set(r.pairs.filter((p) => p.outcome === 'slipped').map((p) => p.concept))]
    out.push({ severity: 'medium', text: `Answered ${r.pairCounts.slipped} post-test question${r.pairCounts.slipped === 1 ? '' : 's'} wrong after getting ${r.pairCounts.slipped === 1 ? 'it' : 'them'} right on the pre-test (${concepts.join(', ')}). Worth a quick review.` })
  }
  if (r.hints.perScoredAttempt !== null && r.hints.perScoredAttempt >= 1) {
    out.push({ severity: 'info', text: `Uses a hint on most tries (${r.hints.perScoredAttempt} per try). Encourage a first try without one.` })
  }
  const postTest = r.tests.find((t) => t.kind === 'post' && t.scorePct === null)
  const preTaken = r.tests.some((t) => t.kind === 'pre' && t.scorePct !== null)
  if (postTest && preTaken && r.status.kind === 'done') out.push({ severity: 'info', text: `Ready for the ${postTest.module} post-test.` })
  for (const m of r.mastery.filter((x) => x.band === 'strength')) out.push({ severity: 'info', text: `Strong in ${m.concept} (${m.masteryPct}%). Could help a classmate.` })
  if (out.length === 0) out.push({ severity: 'info', text: 'On track. No action needed right now.' })
  return out
}

/** A short, kind note the instructor can copy and send themselves (the system drafts, a human sends). */
export function noteDraft(r: StudentReport): string {
  const first = r.name.split(' ')[0] || r.name
  if (!r.joined) return `Hi ${first}, here is your login card for ${r.className}. Type the code once on your device and you are in. Ask me if anything does not work.`
  const lines = [`Hi ${first},`]
  if (r.completion.required > 0) lines.push(`you have finished ${r.completion.pct}% of your work in ${r.className}.`)
  const strong = r.mastery.find((m) => m.band === 'strength')
  if (strong) lines.push(`Great work on ${strong.concept}.`)
  const focus = r.mastery.find((m) => m.band === 'focus')
  if (r.struggles.current[0]) lines.push(`I saw "${r.struggles.current[0].activity}" is giving you trouble. Let's look at it together.`)
  else if (focus) lines.push(`Next, let's practice ${focus.concept} together.`)
  else if (r.current) lines.push(`Your next step is "${r.current.activity}".`)
  lines.push('Ask me any time you get stuck.')
  return lines.join(' ')
}
