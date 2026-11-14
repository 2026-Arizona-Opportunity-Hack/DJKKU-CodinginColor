/**
 * In-memory StudentApi (B15). Behaves like lane A's functions: computes lock status
 * on its side, refuses locked activities, grades answers, never returns answer keys.
 * State persists to localStorage (when given) so a demo survives a reload.
 */
import type { ActivityResponse, Question, QuestionResponse } from '@/shared/content'

import { HEARTBEAT_SECONDS, type Me, type StudentApi } from './api'
import { ApiError } from './errors'
import { GuestProgressSchema, type GuestProgress } from './guestProgress'
import {
  SEED_CLASS,
  SEED_HINTS,
  SEED_JOIN_CODE,
  SEED_LOGIN_CODES,
  SEED_MODULES,
  SEED_ROSTER,
  type AnswerKey,
  type SeedActivity,
  type SeedAssessment,
  type SeedModule,
} from './mockSeed'
import type { Activity, ClaimResult, ClassOutline, ItemStatus, OutlineModule, SubmitResult } from './types'
import { DisplayNameSchema } from './validation'

export type MockState = {
  me: Me | null
  done: string[] // activity ids
  assessments: Record<string, { score_pct: number }>
  claimedSeats: string[]
  extraCodes: Record<string, string> // login code -> display name (self-registered)
  hintsUsed: Record<string, number>
  seconds: Record<string, number>
}

export const MOCK_STORAGE_KEY = 'cic.mock.v1'
export const MAX_HINTS = 3

export const initialMockState = (): MockState => ({
  me: null,
  done: [],
  assessments: {},
  claimedSeats: [],
  extraCodes: {},
  hintsUsed: {},
  seconds: {},
})

type Options = { storage?: Storage | null; latencyMs?: number; state?: Partial<MockState> }

const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')
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

function grade(key: AnswerKey, response: QuestionResponse): boolean | null {
  const norm = (s: string) => s.trim().toLowerCase()
  switch (key.type) {
    case 'mcq':
      return 'choice_id' in response && response.choice_id === key.choice_id
    case 'short_answer':
      return 'text' in response && key.accept.includes(norm(response.text))
    case 'fill_blank':
      return (
        'blanks' in response &&
        response.blanks.length === key.blanks.length &&
        key.blanks.every((b, i) => norm(response.blanks[i] ?? '') === b)
      )
    case 'ordering':
      return 'order' in response && response.order.join('|') === key.order.join('|')
    case 'reflection':
      return null
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
      return Array.isArray(o.blanks) && o.blanks.length === q.blanks
    case 'ordering':
      return Array.isArray(o.order) && o.order.length === q.items?.length
  }
}

function questionsOf(a: SeedActivity): Question[] {
  if (a.kind === 'check' || a.kind === 'exit') return [a.content.question]
  if (a.kind === 'worksheet') return a.content.items
  return []
}

/** Strip answer keys and feedback before anything leaves the "server". */
function toPublicActivity(a: SeedActivity, status: ItemStatus, prev?: string, next?: string): Activity {
  return clone({
    activity_id: a.activity_id,
    title: a.title,
    status,
    prev_id: prev ?? null,
    next_id: next ?? null,
    kind: a.kind,
    content: a.content,
  } as Activity)
}

export function createMockApi(opts: Options = {}): StudentApi & { readonly state: MockState } {
  const storage = opts.storage === undefined ? (typeof window !== 'undefined' ? window.localStorage : null) : opts.storage
  const latency = opts.latencyMs ?? 0
  let state: MockState = { ...initialMockState(), ...load(), ...opts.state }

  function load(): Partial<MockState> {
    if (!storage) return {}
    try {
      const raw = storage.getItem(MOCK_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Partial<MockState>) : {}
    } catch {
      return {}
    }
  }
  function save() {
    storage?.setItem(MOCK_STORAGE_KEY, JSON.stringify(state))
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

  /** The lock rules, as the server would apply them. */
  function outline(): ClassOutline {
    const modules: OutlineModule[] = SEED_MODULES.map((m, mi) => {
      const prevModule = mi > 0 ? SEED_MODULES[mi - 1] : undefined
      const moduleLockedBy = prevModule && !moduleComplete(prevModule) ? prevModule.title : null
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

  function claim(display_name: string): ClaimResult {
    const me: Me = { display_name, class_id: SEED_CLASS.class_id, class_name: SEED_CLASS.class_name }
    update((s) => ({ ...s, me }))
    return clone(me)
  }

  const api: StudentApi & { readonly state: MockState } = {
    source: 'mock',
    get state() {
      return clone(state)
    },

    getMe: () => delay(() => clone(state.me)),
    signOut: () => delay(() => update((s) => ({ ...s, me: null }))),

    claimLoginCode: (code) =>
      delay(() => {
        const c = normalizeCode(code)
        const seeded = SEED_LOGIN_CODES[c]
        const name = seeded?.display_name ?? state.extraCodes[c]
        if (!name) throw new ApiError('invalid_code')
        return claim(name)
      }),

    listJoinRoster: (joinCode) =>
      delay(() => {
        if (normalizeCode(joinCode) !== SEED_JOIN_CODE) throw new ApiError('invalid_code')
        return clone(SEED_ROSTER.filter((s) => !state.claimedSeats.includes(s.member_id)))
      }),

    claimRosterSeat: (joinCode, memberId) =>
      delay(() => {
        if (normalizeCode(joinCode) !== SEED_JOIN_CODE) throw new ApiError('invalid_code')
        const seat = SEED_ROSTER.find((s) => s.member_id === memberId)
        if (!seat) throw new ApiError('not_found')
        if (state.claimedSeats.includes(memberId)) throw new ApiError('seat_taken')
        update((s) => ({ ...s, claimedSeats: [...s.claimedSeats, memberId] }))
        return claim(seat.label)
      }),

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
        for (const m of outline().modules)
          for (const l of m.lessons)
            for (const a of l.activities)
              if (a.status !== 'done' && a.required)
                return { module_id: m.module_id, lesson_id: l.lesson_id, activity_id: a.activity_id }
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
          items: a.items.map(({ concept: _concept, ...q }) => q),
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
        for (const item of a.items) {
          const key = a.keys[item.id]
          const r = responses[item.id]
          const ok = key && r && isValidResponse(item, r) ? grade(key, r) === true : false
          if (ok) right++
          const c = byConcept.get(item.concept) ?? { right: 0, total: 0 }
          byConcept.set(item.concept, { right: c.right + (ok ? 1 : 0), total: c.total + 1 })
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
        return { login_code }
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
        return { hint: SEED_HINTS[used] ?? SEED_HINTS[0]!, source: 'ladder' as const, remaining: MAX_HINTS - used - 1 }
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
  const questions = questionsOf(a)
  const answers: Record<string, unknown> =
    a.kind === 'worksheet' ? ('answers' in response ? response.answers : {}) : { [questions[0]!.id]: response }
  const graded = questions.map((q) => {
    const r = answers[q.id]
    if (!isValidResponse(q, r)) throw new ApiError('invalid_response')
    const key = a.keys[q.id]
    return key ? grade(key, r) : null
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
  return { is_correct, score, feedback, explanation: is_correct ? (a.explanation ?? null) : null, completed }
}
