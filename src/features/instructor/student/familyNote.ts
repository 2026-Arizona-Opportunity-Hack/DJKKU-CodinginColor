import type { StudentReport } from './report'

/**
 * A short, positive-first message to a student's family, drafted from the report. The instructor edits it
 * and sends it from their own school tool: nothing is sent from here. Short personal messages home raised
 * course completion and cut dropout in a credit-recovery program (Kraft and Rogers 2015).
 */
export function draftNoteHome(r: StudentReport): string {
  const name = r.name
  const lines: string[] = [`Hello! This is a quick note from ${r.className} at Coding in Color about ${name}.`]

  if (r.completion.completed > 0) {
    lines.push(`${name} has finished ${r.completion.completed} of ${r.completion.required} activities so far${r.current ? ` and is now working on "${r.current.activity}"` : ''}.`)
  } else {
    lines.push(`${name} is just getting started, and we are glad to have them in class.`)
  }

  const gain = r.gain.find((g) => g.complete && g.gainPoints !== null && g.gainPoints > 0)
  if (gain && gain.prePct !== null && gain.postPct !== null) {
    lines.push(`On ${gain.module}, ${name} went from ${Math.round(gain.prePct)}% on the first quiz to ${Math.round(gain.postPct)}% on the final one. That is real progress.`)
  }

  const strength = r.mastery.find((m) => m.band === 'strength')
  if (strength) lines.push(`${name} is doing especially well with ${strength.concept.toLowerCase()}.`)

  if (r.daysSinceActive !== null && r.daysSinceActive >= 7) {
    lines.push(`We have missed ${name} in class lately. They can catch up from any computer or phone with their login code, and the "Start here" page shows a short catch-up plan.`)
  }

  const focus = r.mastery.find((m) => m.band === 'focus')
  const topic = focus ? focus.concept.toLowerCase() : r.current?.lesson.toLowerCase()
  if (topic) lines.push(`Next we are practicing ${topic}. One way to help at home: ask ${name} to explain it to you in their own words.`)

  lines.push(`Thank you for supporting ${name}. Reply any time if you have questions.`)
  return lines.join(' ')
}
