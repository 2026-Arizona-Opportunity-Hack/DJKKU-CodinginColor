/**
 * In-memory StudentApi (B15). Behaves like lane A's functions: computes lock status
 * on its side, refuses locked activities, grades answers with lane C's key shapes,
 * and never returns answer keys. State persists to localStorage (when given) so a
 * demo survives a reload.
 */
import { splitQuestion, type AuthoredQuestion, type QuestionKey } from '@shared/authoring/schemas'

import { HEARTBEAT_SECONDS, type Me, type StudentApi } from './api'
import { blankCount, type ActivityResponse, type Question, type QuestionResponse } from './content'
import { ApiError } from './errors'
import { GuestProgressSchema, type GuestProgress } from './guestProgress'
import {
  FALLBACK_HINTS,
  SEED_CLASS,
  SEED_MODULES,
  SEED_STUDENT,
  type SeedActivity,
  type SeedAssessment,
  type SeedModule,
} from './mockSeed'
import type { Activity, ClassOutline, ItemStatus, OutlineModule, SubmitResult } from './types'
import { getStore, safeGet, safeParse, safeSet } from './safeStorage'
import { DisplayNameSchema } from './validation'

export type MockState = {
  me: Me | null
  done: string[] // activity ids
  assessments: Record<string, { score_pct: number }>
  extraCodes: Record<string, string> // login code -> display name (self-registered)
  hintsUsed: Record<string, number>
  seconds: Record<string, number>
}

export const MOCK_STORAGE_KEY = 'cic.mock.v1'
export const MAX_HINTS = 3

/** Mock mode has no working sign-in page (the auth feature owns login), so it starts signed in as the demo student. */
export const initialMockState = (): MockState => ({
  me: { ...SEED_STUDENT },
  done: [],
  assessments: {},
  extraCodes: {},
  hintsUsed: {},
  seconds: {},
})

type Options = { storage?: Storage | null; latencyMs?: number; state?: Partial<MockState> }

const clone = <T>(v: T): T => structuredClone(v)

function allActivities(m: SeedModule): SeedActivity[] {
  return m.lessons.flatMap((l) => l.activities)
}

function findActivity(activityId: string): { module: SeedModule; activity: SeedActivity } | null {
  for (const module of SEED_MODULES) {
    const activity = allActivities(module).find((a) => a.activity_id === activityId)
    if (activity) return { module, activity }
  }
  return null
}

function findAssessment(id: string): SeedAssessment | null {
  for (const m of SEED_MODULES) {
    if (m.pretest.assessment_id === id) return m.pretest
    if (m.posttest.assessment_id === id) return m.posttest
  }
  return null
}

/** Grade one answer against lane C's key shape. null = unscored (reflection). */
function grade(key: QuestionKey | null, r: QuestionResponse): boolean | null {
  if (!key) return null
  const norm = (s: string, caseSensitive: boolean) => (caseSensitive ? s.trim() : s.trim().toLowerCase())
  switch (key.type) {
    case 'mcq':
      return 'choice_id' in r && r.choice_id === key.correctChoiceId
    case 'short_answer':
      return 'text' in r && key.accepted.some((a) => norm(a, key.caseSensitive) === norm(r.text, key.caseSensitive))
    case 'fill_blank':
      return (
        'blanks' in r &&
        r.blanks.length === key.blanks.length &&
        key.blanks.every((accepted, i) => accepted.some((a) => norm(a, key.caseSensitive) === norm(r.blanks[i] ?? '', key.caseSensitive)))
      )
    case 'ordering':
      return 'order' in r && r.order.join('|') === key.correctOrder.join('|')
  }
}

function isValidResponse(q: Question, r: unknown): r is QuestionResponse {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  switch (q.type) {
    case 'mcq':
      return typeof o.choice_id === 'string'
    case 'short_answer':
      return typeof o.text === 'string' && o.text.length <= 500
    case 'reflection':
      return typeof o.text === 'string' && o.text.trim().length > 0 && o.text.length <= 2000
    case 'fill_blank':
      return Array.isArray(o.blanks) && o.blanks.length === blankCount(q)
    case 'ordering':
      return Array.isArray(o.order) && o.order.length === q.items.length
  }
}

const authoredOf = (a: SeedActivity): AuthoredQuestion[] => ('questions' in a ? a.questions : [])

/** What leaves the "server": lane C's student-safe content only (splitQuestion drops keys and shuffles ordering items). */
function toPublicActivity(a: SeedActivity, status: ItemStatus, prev?: string, next?: string): Activity {
  const base = { activity_id: a.activity_id, title: a.title, status, prev_id: prev ?? null, next_id: next ?? null }
  if (a.kind === 'video' || a.kind === 'reading') return clone({ ...base, kind: a.kind, content: a.content } as Activity)
  return clone({ ...base, kind: a.kind, content: { questions: a.questions.map((q) => splitQuestion(q).content) } } as Activity)
}

export function createMockApi(opts: Options = {}): StudentApi & { readonly state: MockState } {
  const storage = opts.storage === undefined ? getStore() : opts.storage
  const latency = opts.latencyMs ?? 0
  let state: MockState = { ...initialMockState(), ...load(), ...opts.state }

  function load(): Partial<MockState> {
    const saved = safeParse(safeGet(MOCK_STORAGE_KEY, storage))
    return saved && typeof saved === 'object' ? (saved as Partial<MockState>) : {}
  }
  function save() {
    safeSet(MOCK_STORAGE_KEY, JSON.stringify(state), storage)
  }
  function update(fn: (s: MockState) => MockState) {
    state = fn(state)
    save()
  }
  async function delay<T>(fn: () => T): Promise<T> {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency))
    return fn()
  }
  function requireMe(): Me {
    if (!state.me) throw new ApiError('unauthenticated')
    return state.me
  }

  const isDone = (id: string) => state.done.includes(id)
  const pretestTaken = (m: SeedModule) => m.pretest.assessment_id in state.assessments
  const moduleComplete = (m: SeedModule) => allActivities(m).every((a) => !a.required || isDone(a.activity_id))
  // Like the database, a module only counts as finished (and opens the next one) once its post-test is taken too.
  const moduleFinished = (m: SeedModule) => moduleComplete(m) && m.posttest.assessment_id in state.assessments

  /** The lock rules, as the server would apply them. */
  function outline(): ClassOutline {
    const modules: OutlineModule[] = SEED_MODULES.map((m, mi) => {
      const prevModule = mi > 0 ? SEED_MODULES[mi - 1] : undefined
      const moduleLockedBy = prevModule && !moduleFinished(prevModule) ? prevModule.title : null
      const pretestStatus: ItemStatus = moduleLockedBy ? 'locked' : pretestTaken(m) ? 'done' : 'available'
      let blocker: string | null = moduleLockedBy
        ? `Finish '${moduleLockedBy}' first`
        : pretestTaken(m)
          ? null
          : `Take the '${m.title}' pretest first`
      const lessons = m.lessons.map((l, li) => ({
        lesson_id: l.lesson_id,
        title: l.title,
        position: li + 1,
        activities: l.activities.map((a, ai) => {
          const status: ItemStatus = isDone(a.activity_id) ? 'done' : blocker ? 'locked' : 'available'
          const row = {
            activity_id: a.activity_id,
            title: a.title,
            kind: a.kind,
            position: ai + 1,
            required: a.required,
            status,
            locked_reason: status === 'locked' ? blocker : null,
          }
          if (a.required && !isDone(a.activity_id) && !blocker) blocker = `Finish '${a.title}' first`
          return row
        }),
      }))
      const posttestStatus: ItemStatus =
        m.posttest.assessment_id in state.assessments ? 'done' : moduleComplete(m) && !moduleLockedBy ? 'available' : 'locked'
      return {
        module_id: m.module_id,
        title: m.title,
        position: mi + 1,
        pretest: { assessment_id: m.pretest.assessment_id, status: pretestStatus },
        posttest: { assessment_id: m.posttest.assessment_id, status: posttestStatus },
        lessons,
      }
    })
    return { modules }
  }

  function statusOf(activityId: string): ItemStatus {
    for (const m of outline().modules)
      for (const l of m.lessons) for (const a of l.activities) if (a.activity_id === activityId) return a.status
    throw new ApiError('not_found')
  }

  function assessmentStatus(id: string): ItemStatus {
    for (const m of outline().modules) {
      if (m.pretest?.assessment_id === id) return m.pretest.status
      if (m.posttest?.assessment_id === id) return m.posttest.status
    }
    throw new ApiError('not_found')
  }

  function neighbours(m: SeedModule, id: string): { prev?: string; next?: string } {
    const list = allActivities(m)
    const i = list.findIndex((a) => a.activity_id === id)
    return { prev: list[i - 1]?.activity_id, next: list[i + 1]?.activity_id }
  }

  const api: StudentApi & { readonly state: MockState } = {
    source: 'mock',
    get state() {
      return clone(state)
    },

    getMe: () => delay(() => clone(state.me)),
    signOut: () => delay(() => update((s) => ({ ...s, me: null }))),

    getMyClasses: () =>
      delay(() => {
        requireMe()
        return [clone(SEED_CLASS)]
      }),

    getClassOutline: (classId) =>
      delay(() => {
        requireMe()
        if (classId !== SEED_CLASS.class_id) throw new ApiError('not_found')
        return outline()
      }),

    nextActivity: (classId) =>
      delay(() => {
        requireMe()
        if (classId !== SEED_CLASS.class_id) throw new ApiError('not_found')
        // Like the database: the first AVAILABLE required activity, and null when the next step is
        // a pre-test or post-test (the client then reads the outline). A module is only passed
        // once its required work is done and its post-test is taken.
        for (const m of outline().modules) {
          for (const l of m.lessons)
            for (const a of l.activities)
              if (a.status === 'available' && a.required)
                return { module_id: m.module_id, lesson_id: l.lesson_id, activity_id: a.activity_id }
          const seed = SEED_MODULES.find((s) => s.module_id === m.module_id)!
          if (!moduleFinished(seed)) return null
        }
        return null
      }),

    getActivity: (activityId) =>
      delay(() => {
        requireMe()
        const found = findActivity(activityId)
        if (!found) throw new ApiError('not_found')
        const status = statusOf(activityId)
        if (status === 'locked') throw new ApiError('locked')
        const { prev, next } = neighbours(found.module, activityId)
        return toPublicActivity(found.activity, status, prev, next)
      }),

    submitAnswer: (activityId, response) =>
      delay((): SubmitResult => {
        requireMe()
        const found = findActivity(activityId)
        if (!found) throw new ApiError('not_found')
        if (statusOf(activityId) === 'locked') throw new ApiError('locked')
        const { activity, module } = found
        const result = gradeActivity(activity, response)
        const wasComplete = moduleComplete(module)
        if (result.completed && !isDone(activityId)) update((s) => ({ ...s, done: [...s.done, activityId] }))
        const nowComplete = moduleComplete(module)
        const nextModule = SEED_MODULES[SEED_MODULES.indexOf(module) + 1]
        const moduleJustCompleted = !wasComplete && nowComplete
        return {
          ...result,
          next_activity_id: result.completed ? (neighbours(module, activityId).next ?? null) : null,
          module_completed: moduleJustCompleted,
          unlocked_module_title: moduleJustCompleted ? (nextModule?.title ?? null) : null,
        }
      }),

    getAssessment: (assessmentId) =>
      delay(() => {
        requireMe()
        const a = findAssessment(assessmentId)
        if (!a) throw new ApiError('not_found')
        if (assessmentStatus(assessmentId) === 'locked') throw new ApiError('locked')
        return clone({
          assessment_id: a.assessment_id,
          kind: a.kind,
          items: a.items.map((i) => splitQuestion(i.question).content),
          taken: assessmentId in state.assessments,
        })
      }),

    submitAssessment: (assessmentId, responses) =>
      delay(() => {
        requireMe()
        const a = findAssessment(assessmentId)
        if (!a) throw new ApiError('not_found')
        if (assessmentId in state.assessments) throw new ApiError('already_taken')
        if (assessmentStatus(assessmentId) === 'locked') throw new ApiError('locked')
        const byConcept = new Map<string, { right: number; total: number }>()
        let right = 0
        for (const { question } of a.items) {
          const { content, key } = question
          const r = responses[content.id]
          const ok = r !== undefined && isValidResponse(content, r) && grade(key, r) === true
          if (ok) right++
          const concept = 'conceptId' in content ? content.conceptId : 'reflection'
          const c = byConcept.get(concept) ?? { right: 0, total: 0 }
          byConcept.set(concept, { right: c.right + (ok ? 1 : 0), total: c.total + 1 })
        }
        const score_pct = Math.round((right / a.items.length) * 100)
        update((s) => ({ ...s, assessments: { ...s.assessments, [assessmentId]: { score_pct } } }))
        return {
          score_pct,
          per_concept: [...byConcept].map(([concept, c]) => ({ concept, pct: Math.round((c.right / c.total) * 100) })),
        }
      }),

    heartbeat: (activityId, seconds) =>
      delay(() => {
        requireMe()
        const s = Math.min(Math.max(0, Math.floor(seconds)), HEARTBEAT_SECONDS)
        update((st) => ({ ...st, seconds: { ...st.seconds, [activityId]: (st.seconds[activityId] ?? 0) + s } }))
      }),

    getCatchUp: (classId) =>
      delay(() => {
        requireMe()
        if (classId !== SEED_CLASS.class_id) throw new ApiError('not_found')
        // Same order and default minutes as the database; the mock has no classmates, so never "behind".
        const MIN: Record<string, number> = { video: 5, reading: 4, worksheet: 10 }
        const steps = outline().modules.flatMap((m) => [
          ...(m.pretest && m.pretest.status !== 'done' ? [{ kind: 'pretest', activity_id: null, assessment_id: m.pretest.assessment_id, title: `Pre-test: ${m.title}`, minutes: 5 }] : []),
          ...m.lessons.flatMap((l) => l.activities.filter((a) => a.required && a.status !== 'done').map((a) => ({ kind: a.kind, activity_id: a.activity_id, assessment_id: null, title: a.title, minutes: MIN[a.kind] ?? 3 }))),
          ...(m.posttest && m.posttest.status !== 'done' ? [{ kind: 'posttest', activity_id: null, assessment_id: m.posttest.assessment_id, title: `Post-test: ${m.title}`, minutes: 5 }] : []),
        ])
        return { steps_left: steps.length, minutes_left: steps.reduce((n, s) => n + s.minutes, 0), behind_by: 0, steps: steps.slice(0, 8) }
      }),

    getMyProgress: (classId) =>
      delay(() => {
        requireMe()
        if (classId !== SEED_CLASS.class_id) throw new ApiError('not_found')
        const all = SEED_MODULES.flatMap(allActivities)
        return {
          completed: all.filter((a) => isDone(a.activity_id)).length,
          total: all.length,
          modules: SEED_MODULES.map((m) => {
            const acts = allActivities(m)
            const pre = state.assessments[m.pretest.assessment_id]?.score_pct ?? null
            const post = state.assessments[m.posttest.assessment_id]?.score_pct ?? null
            return {
              title: m.title,
              pct: Math.round((acts.filter((a) => isDone(a.activity_id)).length / acts.length) * 100),
              pre_pct: pre,
              post_pct: post,
              gain: pre !== null && post !== null ? post - pre : null,
            }
          }),
        }
      }),

    listOpenModules: () =>
      delay(() =>
        clone(
          SEED_MODULES.filter((m) => m.open).map((m) => ({
            module_id: m.module_id,
            title: m.title,
            summary: m.summary,
            lessons: m.lessons.map((l) => ({
              lesson_id: l.lesson_id,
              title: l.title,
              activities: l.activities.map((a) => ({ activity_id: a.activity_id, title: a.title, kind: a.kind })),
            })),
          })),
        ),
      ),

    getOpenActivity: (activityId) =>
      delay(() => {
        const found = findActivity(activityId)
        if (!found || !found.module.open) throw new ApiError('not_found')
        const { prev, next } = neighbours(found.module, activityId)
        return toPublicActivity(found.activity, 'available', prev, next)
      }),

    selfRegister: (displayName) =>
      delay(() => {
        if (!DisplayNameSchema.safeParse(displayName).success) throw new ApiError('invalid_name', { status: 400 })
        const n = Object.keys(state.extraCodes).length + 1
        const login_code = `GREEN-OWL-${String(40 + n)}`
        update((s) => ({ ...s, extraCodes: { ...s.extraCodes, [login_code]: displayName.trim() } }))
        return { class_id: 'class-open', login_code }
      }),

    importGuestProgress: (payload: GuestProgress) =>
      delay(() => {
        requireMe()
        const parsed = GuestProgressSchema.safeParse(payload)
        if (!parsed.success) throw new ApiError('invalid_response', { cause: parsed.error })
        // Only open-content activities can be imported, and only ones not already done.
        const ids = Object.keys(parsed.data.completed).filter((id) => findActivity(id)?.module.open && !isDone(id))
        update((s) => ({ ...s, done: [...s.done, ...ids] }))
        return { imported: ids.length }
      }),

    requestHint: (activityId) =>
      delay(() => {
        requireMe()
        const used = state.hintsUsed[activityId] ?? 0
        if (used >= MAX_HINTS) throw new ApiError('rate_limited', { status: 429 })
        update((s) => ({ ...s, hintsUsed: { ...s.hintsUsed, [activityId]: used + 1 } }))
        // Hint ladder from the first scored question's key (lane C), like the server's "ladder" source.
        const found = findActivity(activityId)
        const ladder = (found ? authoredOf(found.activity) : []).find((q) => q.key)?.key?.hints ?? []
        const hint = ladder[used] ?? FALLBACK_HINTS[used] ?? FALLBACK_HINTS[0]!
        return { hint, source: 'ladder' as const, remaining: MAX_HINTS - used - 1 }
      }),
  }
  return api
}

function gradeActivity(
  a: SeedActivity,
  response: ActivityResponse,
): Pick<SubmitResult, 'is_correct' | 'score' | 'feedback' | 'explanation' | 'completed'> {
  if (a.kind === 'video' || a.kind === 'reading') {
    if (!('viewed' in response) || response.viewed !== true) throw new ApiError('invalid_response')
    return { is_correct: null, score: 1, completed: true }
  }
  const answers: Record<string, unknown> = 'answers' in response ? response.answers : {}
  const authored = authoredOf(a)
  const graded = authored.map(({ content, key }) => {
    const r = answers[content.id]
    if (!isValidResponse(content, r)) throw new ApiError('invalid_response')
    return grade(key, r)
  })
  const scored = graded.filter((g): g is boolean => g !== null)
  const right = scored.filter(Boolean).length
  const is_correct = scored.length === 0 ? null : right === scored.length
  const score = scored.length === 0 ? 1 : right / scored.length
  // Worksheets and reflections complete on submit; checks and exits need a correct answer.
  const completed = a.kind === 'worksheet' || is_correct !== false
  const feedback =
    a.kind === 'worksheet'
      ? `${right} of ${scored.length} correct.`
      : is_correct === null
        ? 'Saved. Thanks for reflecting.'
        : is_correct
          ? (a.feedback?.correct ?? 'Correct!')
          : (a.feedback?.incorrect ?? 'Not quite. Try again.')
  const explanation = is_correct ? (authored.find((q) => q.key?.explanation)?.key?.explanation ?? null) : null
  return { is_correct, score, feedback, explanation, completed }
}
