import { z } from 'zod'
import type { ApiDataSource, ClassGainRow, ClassProgressRow } from './source'
import { API_SCOPES, type ApiScope } from './types'

// Reads the read API's numbers from Supabase over its REST interface (PostgREST),
// using the service role key. That key bypasses row-level security, so this file only
// ever selects from the two aggregate views and from label tables (school, class,
// module and concept names). It never selects a per-student table.
//
// The service role key must stay on the server: it comes from Cloudflare environment
// variables, never from the browser, and is never logged or returned.

export interface SupabaseSourceOptions {
  url: string
  serviceRoleKey: string
  /** For tests. Defaults to the global fetch. */
  fetch?: typeof fetch
}

const num = z.coerce.number()
const nullableNum = z.coerce.number().nullable()

const KeyResult = z
  .object({ api_key_id: z.string(), scope: z.array(z.string()) })
  .nullable()
const ProgressRows = z.array(
  z.object({ class_id: z.string(), students: num, avg_completion_pct: num }),
)
const GainRows = z.array(
  z.object({
    class_id: z.string(),
    module_id: z.string(),
    concept_id: z.string().nullable(),
    pre_pct: nullableNum,
    post_pct: nullableNum,
    gain_points: nullableNum,
    normalized_gain: nullableNum,
    complete_count: num,
    incomplete_count: num,
  }),
)
const ClassRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    term: z.string().nullable(),
    school_id: z.string().nullable(),
  }),
)
const NamedRows = z.array(z.object({ id: z.string(), name: z.string() }))
const TitledRows = z.array(z.object({ id: z.string(), title: z.string() }))

export function createSupabaseSource(options: SupabaseSourceOptions): ApiDataSource {
  const base = `${options.url.replace(/\/+$/, '')}/rest/v1`
  const doFetch = options.fetch ?? fetch
  const auth = { apikey: options.serviceRoleKey, Authorization: `Bearer ${options.serviceRoleKey}` }

  async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    const res = await doFetch(`${base}/${path}`, {
      ...init,
      headers: { ...auth, ...init?.headers },
    })
    // Say which call failed and with what status, never the URL's query or any key.
    if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} answered ${res.status}`)
    return schema.parse(await res.json())
  }

  async function labels() {
    const [classes, schools, modules, concepts] = await Promise.all([
      request('classes?select=id,name,term,school_id', ClassRows),
      request('schools?select=id,name', NamedRows),
      request('modules?select=id,title', TitledRows),
      request('concepts?select=id,name', NamedRows),
    ])
    const schoolName = new Map(schools.map((s) => [s.id, s.name]))
    const classById = new Map(
      classes.map((c) => [
        c.id,
        {
          class_name: c.name,
          term: c.term,
          school_name: c.school_id ? (schoolName.get(c.school_id) ?? null) : null,
        },
      ]),
    )
    return {
      classById,
      moduleTitle: new Map(modules.map((m) => [m.id, m.title])),
      conceptName: new Map(concepts.map((c) => [c.id, c.name])),
    }
  }

  return {
    async validateKey(rawKey) {
      const result = await request('rpc/validate_api_key', KeyResult, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_raw_key: rawKey }),
      })
      if (!result) return null
      const scope = result.scope.filter((s): s is ApiScope =>
        (API_SCOPES as readonly string[]).includes(s),
      )
      return { apiKeyId: result.api_key_id, scope }
    },

    async classProgress() {
      const [rows, { classById }] = await Promise.all([
        request('api_class_progress?select=class_id,students,avg_completion_pct', ProgressRows),
        labels(),
      ])
      const out: ClassProgressRow[] = []
      for (const r of rows) {
        const label = classById.get(r.class_id)
        if (label) out.push({ class_id: r.class_id, ...label, students: r.students, avg_completion_pct: r.avg_completion_pct })
      }
      return out
    },

    async classGain() {
      const [rows, { classById, moduleTitle, conceptName }] = await Promise.all([
        request(
          'api_class_gain?select=class_id,module_id,concept_id,pre_pct,post_pct,gain_points,normalized_gain,complete_count,incomplete_count',
          GainRows,
        ),
        labels(),
      ])
      const out: ClassGainRow[] = []
      for (const r of rows) {
        const label = classById.get(r.class_id)
        const title = moduleTitle.get(r.module_id)
        if (!label || !title) continue
        out.push({
          class_id: r.class_id,
          ...label,
          module_id: r.module_id,
          module_title: title,
          concept_id: r.concept_id,
          concept_name: r.concept_id ? (conceptName.get(r.concept_id) ?? r.concept_id) : null,
          pre_pct: r.pre_pct,
          post_pct: r.post_pct,
          gain_points: r.gain_points,
          normalized_gain: r.normalized_gain,
          complete_count: r.complete_count,
          incomplete_count: r.incomplete_count,
        })
      }
      return out
    },
  }
}
