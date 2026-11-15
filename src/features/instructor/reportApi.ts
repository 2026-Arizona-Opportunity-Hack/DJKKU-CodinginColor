import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { GainRow } from './report'

const num = z.coerce.number()
const nullableNum = z.union([z.null(), z.coerce.number()])
const Gain = z.object({
  module_id: z.string(),
  concept_id: z.string().nullable(),
  pre_pct: nullableNum,
  post_pct: nullableNum,
  gain_points: nullableNum,
  normalized_gain: nullableNum,
  complete_count: num,
  incomplete_count: num,
})
const Named = z.object({ id: z.string(), name: z.string() })
const Titled = z.object({ id: z.string(), title: z.string() })
const ClassInfo = z.object({ name: z.string(), term: z.string().nullable(), schools: z.object({ name: z.string() }).nullable() })
const Progress = z.object({ completion_pct: num, joined: z.boolean() })

async function read<T>(q: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(toSessionError(error).message)
  return schema.parse(data)
}

export interface ReportData {
  className: string
  school: string | null
  term: string | null
  rows: GainRow[]
  moduleTitles: Map<string, string>
  conceptNames: Map<string, string>
  students: number
  avgCompletion: number | null
}

/** Everything the impact report needs for one class. Row-level security limits it to classes you teach. */
export async function loadReport(classId: string): Promise<ReportData> {
  const sb = getSupabase()
  const [cls, rows, progress, concepts] = await Promise.all([
    read(sb.from('classes').select('name, term, schools(name)').eq('id', classId).maybeSingle(), ClassInfo.nullable()),
    read(sb.from('v_learning_gain').select('module_id, concept_id, pre_pct, post_pct, gain_points, normalized_gain, complete_count, incomplete_count').eq('class_id', classId).eq('scope', 'class'), Gain.array()),
    read(sb.from('v_class_progress').select('completion_pct, joined').eq('class_id', classId), Progress.array()),
    read(sb.from('concepts').select('id, name'), Named.array()),
  ])
  if (!cls) throw new Error("We couldn't find that class, or it isn't one you teach.")
  const moduleIds = [...new Set(rows.map((r) => r.module_id))]
  const modules = moduleIds.length ? await read(sb.from('modules').select('id, title').in('id', moduleIds), Titled.array()) : []
  const joined = progress.filter((p) => p.joined)
  return {
    className: cls.name,
    school: cls.schools?.name ?? null,
    term: cls.term,
    rows,
    moduleTitles: new Map(modules.map((m) => [m.id, m.title])),
    conceptNames: new Map(concepts.map((c) => [c.id, c.name])),
    students: joined.length,
    avgCompletion: joined.length ? joined.reduce((s, p) => s + p.completion_pct, 0) / joined.length : null,
  }
}
