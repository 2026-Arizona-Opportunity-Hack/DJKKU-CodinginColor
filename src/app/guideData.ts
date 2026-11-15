import type { FeatureModule, GuideEntry, GuideRole } from '@/lib/feature'
import type { Me } from '@/lib/session'

// The Guide page's data: every feature's own guide entries, plus a few for the app shell itself.
// Pure functions, so the page stays simple and this can be tested on its own.

export const ROLE_ORDER: GuideRole[] = ['visitor', 'student', 'instructor', 'author', 'cic_admin', 'reviewer', 'mentor']

export const ROLE_INFO: Record<GuideRole, { label: string; intro: string }> = {
  visitor: { label: 'Visitor', intro: 'No account needed: try lessons, then sign in with the code or link from your teacher.' },
  student: { label: 'Student', intro: 'Learn at your own pace in your class, take notes, and see how much you have grown.' },
  instructor: { label: 'Instructor', intro: 'Set up a class in minutes, see who needs help, and show the impact.' },
  author: { label: 'Author', intro: 'Build modules from your own material or YouTube and GitHub, with tests drafted by AI.' },
  cic_admin: { label: 'CIC admin', intro: 'Publish curriculum, invite staff and see every program. You can also use everything in the Instructor, Author and Reviewer tabs.' },
  reviewer: { label: 'Reviewer', intro: 'Read every published module as students see it. Read-only: no student data and no answers.' },
  mentor: { label: 'Mentor', intro: 'Follow the students an admin assigned to you.' },
}

export const SHELL_GUIDE: GuideEntry[] = [
  { id: 'home', title: 'Home', summary: 'What Coding in Color Learn is, and the three ways in.', to: '/', roles: ['visitor'], group: 'Get in', step: 1 },
  { id: 'privacy', title: 'Privacy', summary: 'What we keep about students, who sees it, and how to delete it.', to: '/privacy', roles: ['visitor', 'student', 'instructor', 'author', 'cic_admin', 'reviewer', 'mentor'], group: 'About this site' },
]

const GENERAL_GROUPS = ['Get in', 'About this site']

export function allEntries(features: FeatureModule[]): GuideEntry[] {
  return [...SHELL_GUIDE, ...features.flatMap((f) => f.guide ?? [])]
}

/** The guide roles a signed-in person has. Admins pass every staff check; authors are flagged instructors. */
export function rolesOf(me: Me | null): GuideRole[] {
  if (!me) return ['visitor']
  switch (me.role) {
    case 'student':
    case 'independent_student':
      return ['student']
    case 'instructor':
      return me.can_author ? ['instructor', 'author'] : ['instructor']
    case 'cic_admin':
      return ['cic_admin', 'instructor', 'author', 'reviewer']
    case 'reviewer':
      return ['reviewer']
    case 'mentor':
      return ['mentor']
    default:
      return ['visitor']
  }
}

/** Which tab opens first: your own role. */
export function defaultRole(me: Me | null): GuideRole {
  return rolesOf(me)[0]!
}

export function canUse(entry: GuideEntry, mine: GuideRole[]): boolean {
  return entry.roles.some((r) => mine.includes(r))
}

/** First steps (in order), then everything else grouped, for one role. */
export function forRole(entries: GuideEntry[], role: GuideRole) {
  const own = entries.filter((e) => e.roles.includes(role))
  const steps = own.filter((e) => e.step !== undefined && e.roles[0] === role).sort((a, b) => a.step! - b.step!)
  // Everything else, grouped: a first step is not repeated below.
  const groups = new Map<string, GuideEntry[]>()
  for (const e of own.filter((x) => !steps.includes(x))) groups.set(e.group, [...(groups.get(e.group) ?? []), e])
  // A role's own work first; the general groups (signing in, privacy) last, except for visitors.
  const general = (name: string) => role !== 'visitor' && GENERAL_GROUPS.includes(name)
  const ordered = [...groups.entries()].sort(([a], [b]) => Number(general(a)) - Number(general(b)))
  return { steps, groups: ordered.map(([name, items]) => ({ name, items })) }
}

/** Search across every role: title, summary and how-to, every word must match. */
export function search(entries: GuideEntry[], query: string): GuideEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return entries.filter((e) => {
    const text = `${e.title} ${e.summary} ${e.howTo ?? ''} ${e.group}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}
