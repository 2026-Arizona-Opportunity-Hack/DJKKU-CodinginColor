import { z } from 'zod'
import { toSessionError } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import type { LiveActivity, LiveProgress, LiveStuck, LiveStudent } from './live'

async function read<T>(q: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(toSessionError(error).message)
  return schema.parse(data)
}

const ClassModule = z.object({
  position: z.number(),
  modules: z.object({
    title: z.string(),
    lessons: z.array(z.object({ position: z.number(), title: z.string(), activities: z.array(z.object({ id: z.string(), position: z.number(), title: z.string(), kind: z.string(), required: z.boolean() })) })),
  }),
})
const Roster = z.object({ student_id: z.string().nullable(), display_name: z.string(), joined: z.boolean() })
const Progress = z.object({ student_id: z.string(), activity_id: z.string(), status: z.enum(['in_progress', 'completed']), updated_at: z.string() })
const Stuck = z.object({ student_id: z.string(), activity_id: z.string().nullable(), reasons: z.array(z.string()) })

export interface LiveData { activities: LiveActivity[]; students: LiveStudent[]; progress: LiveProgress[]; stuck: LiveStuck[] }

/** One snapshot of the class: the assigned activities in order, the signed-in students and their progress. */
export async function loadLive(classId: string): Promise<LiveData> {
  const sb = getSupabase()
  const [modules, roster, progress, stuck] = await Promise.all([
    read(sb.from('class_modules').select('position, modules(title, lessons(position, title, activities(id, position, title, kind, required)))').eq('class_id', classId).order('position'), ClassModule.array()),
    read(sb.from('v_class_progress').select('student_id, display_name, joined').eq('class_id', classId).order('display_name'), Roster.array()),
    read(sb.from('progress').select('student_id, activity_id, status, updated_at').eq('class_id', classId), Progress.array()),
    read(sb.from('v_stuck').select('student_id, activity_id, reasons').eq('class_id', classId), Stuck.array()),
  ])
  const activities = modules.flatMap((cm) =>
    [...cm.modules.lessons].sort((a, b) => a.position - b.position).flatMap((l) =>
      [...l.activities].sort((a, b) => a.position - b.position).filter((a) => a.required).map((a) => ({ id: a.id, title: a.title, kind: a.kind, module: cm.modules.title, lesson: l.title })),
    ),
  )
  const students = roster.filter((r) => r.joined && r.student_id).map((r) => ({ id: r.student_id!, name: r.display_name }))
  return { activities, students, progress, stuck }
}
