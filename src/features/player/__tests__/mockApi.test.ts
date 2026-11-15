// @vitest-environment jsdom
import '../test/setup'
import { describe, expect, it } from 'vitest'

import { readEnv } from '@/features/player/env'
import { ACTIVITY_KINDS, QUESTION_TYPES } from '@/features/player/content'
import { MAYA, MID_MODULE, mockApi } from '@/features/player/test/render'

import { createMockApi, MOCK_STORAGE_KEY } from '../api.mock'
import { SEED_MODULES } from '../mockSeed'

describe('B15 mock data source', () => {
  it('seed covers every activity kind and every question type', () => {
    const activities = SEED_MODULES.flatMap((m) => m.lessons.flatMap((l) => l.activities))
    expect(new Set(activities.map((a) => a.kind))).toEqual(new Set(ACTIVITY_KINDS))
    const types = new Set(
      activities.flatMap((a) =>
        'questions' in a ? a.questions.map((q) => q.content.type) : [],
      ),
    )
    expect(types).toEqual(new Set(QUESTION_TYPES))
    expect(SEED_MODULES).toHaveLength(2)
  })

  it('enforces locks like the server: locked activities cannot be read or answered', async () => {
    const api = mockApi(MID_MODULE)
    await expect(api.getActivity('act-basics-exit')).rejects.toMatchObject({ code: 'locked' })
    await expect(api.submitAnswer('act-basics-exit', { answers: { 'q-basics-exit': { text: 'hi' } } })).rejects.toMatchObject({ code: 'locked' })
    await expect(api.getActivity('act-fn-video')).rejects.toMatchObject({ code: 'locked' })
  })

  it('requires a signed-in student for class data', async () => {
    await expect(mockApi({ me: null }).getMyClasses()).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('never sends answer keys to the client', async () => {
    const api = mockApi(MID_MODULE)
    const a = await api.getActivity('act-loops-sheet')
    expect(JSON.stringify(a)).not.toMatch(/correct|accepted|hints|"key"/)
    const t = await api.getAssessment('pre-basics')
    expect(JSON.stringify(t)).not.toMatch(/correct|accepted|hints|pairKey|"key"/)
  })

  it('a wrong answer does not complete a check; a correct one unlocks the next step', async () => {
    const api = mockApi({ ...MID_MODULE, done: ['act-vars-video', 'act-vars-read'] })
    expect(await api.submitAnswer('act-vars-check', { answers: { 'q-vars-1': { choice_id: 'a' } } })).toMatchObject({ is_correct: false, completed: false })
    expect(await api.nextActivity('class-sat')).toMatchObject({ activity_id: 'act-vars-check' })
    expect(await api.submitAnswer('act-vars-check', { answers: { 'q-vars-1': { choice_id: 'b' } } })).toMatchObject({
      is_correct: true,
      completed: true,
      next_activity_id: 'act-loops-sheet',
    })
  })

  it('matches the database: next is null while a pre-test or post-test is the next step', async () => {
    // Pre-test not taken: every activity is locked, so there is no next activity.
    expect(await mockApi({ me: MAYA }).nextActivity('class-sat')).toBeNull()
    // Pre-test taken: the first activity.
    const afterPre = mockApi({ me: MAYA, assessments: { 'pre-basics': { score_pct: 33 } } })
    expect(await afterPre.nextActivity('class-sat')).toMatchObject({ activity_id: 'act-vars-video' })
    // Every required activity done but the post-test not taken: null again (the next step is the post-test).
    const all = ['act-vars-video', 'act-vars-read', 'act-vars-check', 'act-loops-sheet', 'act-loops-check', 'act-basics-exit']
    const needsPost = mockApi({ me: MAYA, done: all, assessments: { 'pre-basics': { score_pct: 33 } } })
    expect(await needsPost.nextActivity('class-sat')).toBeNull()
    // Post-test taken: the next module's pre-test is up next, still null, never an activity that is locked.
    const next = mockApi({ me: MAYA, done: all, assessments: { 'pre-basics': { score_pct: 33 }, 'post-basics': { score_pct: 90 } } })
    expect(await next.nextActivity('class-sat')).toBeNull()
  })

  it('rejects malformed responses and a second test attempt', async () => {
    const api = mockApi({ me: MAYA })
    await api.submitAssessment('pre-basics', {})
    await expect(api.submitAssessment('pre-basics', {})).rejects.toMatchObject({ code: 'already_taken' })
    await expect(api.getAssessment('post-basics')).rejects.toMatchObject({ code: 'locked' })
    const mid = mockApi(MID_MODULE)
    await expect(mid.submitAnswer('act-vars-check', { answers: { 'q-vars-1': { text: 'b' } } })).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('persists demo state across reloads when given storage', async () => {
    const first = createMockApi({ storage: window.localStorage })
    expect(await first.getMe()).toMatchObject({ display_name: 'Maya R.' }) // starts signed in as the demo student
    await first.signOut()
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).toContain('"me":null')
    expect(await createMockApi({ storage: window.localStorage }).getMe()).toBeNull()
  })
})

describe('env', () => {
  it('defaults to mock without a Supabase URL, and to supabase with one', () => {
    expect(readEnv({}).dataSource).toBe('mock')
    expect(readEnv({ VITE_SUPABASE_URL: '' }).dataSource).toBe('mock')
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' }).dataSource).toBe('supabase')
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_DATA_SOURCE: 'mock' }).dataSource).toBe('mock')
    expect(readEnv({ VITE_FEATURE_HINTS: 'true' }).hintsEnabled).toBe(true)
  })

  it('rejects a bad data source loudly', () => {
    expect(() => readEnv({ VITE_DATA_SOURCE: 'prod' })).toThrow(/VITE_DATA_SOURCE/)
  })
})
