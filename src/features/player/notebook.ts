import type { Note } from './types'

/** Groups notes by module, then lesson, keeping the course order the server sent. */
export function groupNotes(notes: Note[]): { module: string; lessons: { lesson: string; notes: Note[] }[] }[] {
  const out: { module: string; lessons: { lesson: string; notes: Note[] }[] }[] = []
  for (const n of notes) {
    let m = out.find((g) => g.module === n.module_title)
    if (!m) out.push((m = { module: n.module_title, lessons: [] }))
    let l = m.lessons.find((g) => g.lesson === n.lesson_title)
    if (!l) m.lessons.push((l = { lesson: n.lesson_title, notes: [] }))
    l.notes.push(n)
  }
  return out
}
