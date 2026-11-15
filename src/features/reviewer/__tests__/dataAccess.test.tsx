// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewerPage } from '../ReviewerPage'
import { renderAt } from '../test/harness'

// The reviewer page must only ever READ published curriculum. These tests pin down exactly
// which tables it asks for, so a later change that starts reading an answer-key table, a
// student table or a login-code table fails here instead of reaching a reviewer.

const h = vi.hoisted(() => ({ sb: undefined as unknown }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => h.sb }))
vi.mock('@/lib/session', async (orig) => ({
  ...(await orig<typeof import('@/lib/session')>()),
  useMe: () => ({ data: { role: 'reviewer' }, isPending: false }),
  isDemoMode: () => false,
}))

const ID = '30000000-0000-4000-8000-000000000001'
const LIST_ROW = {
  id: ID, title: 'Variables and Loops', version: 1, summary: '', published_at: '2026-11-14T00:00:00Z',
  lessons: [], assessments: [],
}
const FULL_ROW = { ...LIST_ROW, lessons: [], assessments: [] }

/** A stand-in client that records every table read, with the select string and the filters used. */
function recorder() {
  const calls: { table: string; select: string; filters: [string, unknown][] }[] = []
  const rpc = vi.fn(async () => ({ data: null, error: null }))
  const from = vi.fn((table: string) => {
    const call = { table, select: '', filters: [] as [string, unknown][] }
    calls.push(call)
    const rows = table === 'concepts' ? [] : [LIST_ROW]
    const chain: Record<string, unknown> = {}
    chain.select = (s: string) => ((call.select = s), chain)
    chain.eq = (column: string, value: unknown) => (call.filters.push([column, value]), chain)
    chain.order = () => chain
    chain.maybeSingle = async () => ({ data: FULL_ROW, error: null })
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok)
    return chain
  })
  h.sb = { from, rpc }
  return { calls, rpc }
}

const FORBIDDEN = [
  'activity_keys', 'assessment_keys', 'member_login_codes', 'api_keys', 'api_key_secrets',
  'submissions', 'progress', 'assessment_responses', 'assessment_results', 'class_members',
  'hint_events', 'hint_cache', 'mentor_notes', 'profiles',
]

beforeEach(() => vi.clearAllMocks())

describe('what the reviewer page reads', () => {
  it('the module list reads only published modules and concept names', async () => {
    const { calls, rpc } = recorder()
    renderAt(<ReviewerPage />)
    await screen.findByRole('heading', { name: /Variables and Loops/ })

    expect([...new Set(calls.map((c) => c.table))].sort()).toEqual(['concepts', 'modules'])
    expect(calls.find((c) => c.table === 'modules')!.filters).toContainEqual(['status', 'published'])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('one module reads only that published module and concept names', async () => {
    const { calls, rpc } = recorder()
    renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    await screen.findByRole('heading', { name: /Variables and Loops/ })

    expect([...new Set(calls.map((c) => c.table))].sort()).toEqual(['concepts', 'modules'])
    const filters = calls.find((c) => c.table === 'modules')!.filters
    expect(filters).toContainEqual(['status', 'published'])
    expect(filters).toContainEqual(['id', ID])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('never names an answer-key, login-code, API-key or student table, even inside a select', async () => {
    const { calls } = recorder()
    renderAt(<ReviewerPage />, { url: `/review/${ID}` })
    await screen.findByRole('heading', { name: /Variables and Loops/ })

    for (const call of calls) {
      for (const table of FORBIDDEN) {
        expect(call.table).not.toBe(table)
        expect(call.select).not.toContain(table)
      }
    }
  })
})
