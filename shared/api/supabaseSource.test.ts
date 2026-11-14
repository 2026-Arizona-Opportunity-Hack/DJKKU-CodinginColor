import { describe, expect, it } from 'vitest'
import { createSupabaseSource } from './supabaseSource'

const SERVICE_KEY = 'service-role-key-for-tests'

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

/** A fake PostgREST: answers by path and records every call. */
function fakeSupabase(routes: Record<string, unknown | (() => Response)>) {
  const calls: Call[] = []
  const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: { ...(init?.headers as Record<string, string>) },
      body: (init?.body as string) ?? null,
    })
    const path = url.split('/rest/v1/')[1].split('?')[0]
    const route = routes[path]
    if (typeof route === 'function') return (route as () => Response)()
    if (route === undefined) return new Response('not found', { status: 404 })
    return Response.json(route)
  }) as typeof fetch
  return { stub, calls }
}

const labelRoutes = {
  classes: [
    { id: 'c1', name: 'Period 3', term: '2026 Fall', school_id: 's1' },
    { id: 'open', name: 'CIC Open', term: null, school_id: null },
  ],
  schools: [{ id: 's1', name: 'Maryvale' }],
  modules: [{ id: 'm1', title: 'Variables and Loops' }],
  concepts: [{ id: 'loops', name: 'Loops' }],
}

function source(routes: Record<string, unknown | (() => Response)>) {
  const { stub, calls } = fakeSupabase(routes)
  return {
    calls,
    api: createSupabaseSource({ url: 'https://proj.supabase.co/', serviceRoleKey: SERVICE_KEY, fetch: stub }),
  }
}

describe('validateKey', () => {
  it('calls the database function with the raw key and the service role key', async () => {
    const { api, calls } = source({
      'rpc/validate_api_key': { api_key_id: 'k1', scope: ['progress', 'assessments'] },
    })
    expect(await api.validateKey('oh_abc')).toEqual({ apiKeyId: 'k1', scope: ['progress', 'assessments'] })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe('https://proj.supabase.co/rest/v1/rpc/validate_api_key')
    expect(JSON.parse(calls[0].body as string)).toEqual({ p_raw_key: 'oh_abc' })
    expect(calls[0].headers.apikey).toBe(SERVICE_KEY)
    expect(calls[0].headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`)
  })

  it('returns null for an unknown or revoked key', async () => {
    const { api } = source({ 'rpc/validate_api_key': null })
    expect(await api.validateKey('oh_nope')).toBeNull()
  })

  it('drops scopes it does not know', async () => {
    const { api } = source({ 'rpc/validate_api_key': { api_key_id: 'k1', scope: ['progress', 'admin'] } })
    expect((await api.validateKey('oh_abc'))?.scope).toEqual(['progress'])
  })

  it('throws when the database is down, so the handler can answer 503', async () => {
    const { api } = source({ 'rpc/validate_api_key': () => new Response('boom', { status: 500 }) })
    await expect(api.validateKey('oh_abc')).rejects.toThrow('answered 500')
  })

  it('keeps the key out of the error', async () => {
    const { api } = source({ 'rpc/validate_api_key': () => new Response('boom', { status: 500 }) })
    await expect(api.validateKey('oh_secretkey')).rejects.not.toThrow(/oh_secretkey|service-role/)
  })
})

describe('classProgress', () => {
  it('joins school, class and term labels onto the aggregate view', async () => {
    const { api } = source({
      ...labelRoutes,
      api_class_progress: [{ class_id: 'c1', students: 24, avg_completion_pct: '62.50' }],
    })
    expect(await api.classProgress()).toEqual([
      { class_id: 'c1', class_name: 'Period 3', term: '2026 Fall', school_name: 'Maryvale', students: 24, avg_completion_pct: 62.5 },
    ])
  })

  it('gives the open class no school', async () => {
    const { api } = source({
      ...labelRoutes,
      api_class_progress: [{ class_id: 'open', students: 9, avg_completion_pct: 10 }],
    })
    expect((await api.classProgress())[0]).toMatchObject({ class_name: 'CIC Open', school_name: null })
  })

  it('skips a class it has no label for instead of returning an unnamed row', async () => {
    const { api } = source({
      ...labelRoutes,
      api_class_progress: [{ class_id: 'ghost', students: 9, avg_completion_pct: 10 }],
    })
    expect(await api.classProgress()).toEqual([])
  })

  it('reads only the aggregate view and label tables, never a per-student table', async () => {
    const { api, calls } = source({ ...labelRoutes, api_class_progress: [] })
    await api.classProgress()
    const paths = calls.map((c) => c.url.split('/rest/v1/')[1].split('?')[0]).sort()
    expect(paths).toEqual(['api_class_progress', 'classes', 'concepts', 'modules', 'schools'])
  })
})

describe('classGain', () => {
  it('joins module and concept names, and keeps the overall test as concept null', async () => {
    const { api } = source({
      ...labelRoutes,
      api_class_gain: [
        { class_id: 'c1', module_id: 'm1', concept_id: 'loops', pre_pct: 41.2, post_pct: 73.5, gain_points: 32.3, normalized_gain: 0.55, complete_count: 18, incomplete_count: 6 },
        { class_id: 'c1', module_id: 'm1', concept_id: null, pre_pct: 50, post_pct: 70, gain_points: 20, normalized_gain: 0.4, complete_count: 18, incomplete_count: 6 },
      ],
    })
    const rows = await api.classGain()
    expect(rows[0]).toMatchObject({ module_title: 'Variables and Loops', concept_name: 'Loops', school_name: 'Maryvale' })
    expect(rows[1]).toMatchObject({ concept_id: null, concept_name: null })
  })

  it('keeps null scores as null, never zero', async () => {
    const { api } = source({
      ...labelRoutes,
      api_class_gain: [
        { class_id: 'c1', module_id: 'm1', concept_id: null, pre_pct: null, post_pct: null, gain_points: null, normalized_gain: null, complete_count: 0, incomplete_count: 9 },
      ],
    })
    expect((await api.classGain())[0]).toMatchObject({ pre_pct: null, post_pct: null, gain_points: null })
  })

  it('rejects data that is not the shape it expects', async () => {
    const { api } = source({ ...labelRoutes, api_class_gain: [{ class_id: 1 }] })
    await expect(api.classGain()).rejects.toThrow()
  })
})
