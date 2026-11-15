import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Search } from 'lucide-react'
import type { GuideEntry, GuideRole } from '@/lib/feature'
import { isDemoMode, useMe } from '@/lib/session'
import { features } from './features'
import { allEntries, canUse, defaultRole, forRole, ROLE_INFO, ROLE_ORDER, rolesOf, search } from './guideData'

/**
 * `/guide`: every feature, by role, with a link straight to it. Each feature folder describes its own
 * entries (FeatureModule.guide), so this page never needs editing when a feature is added.
 */
export function Guide() {
  const id = useId()
  const me = useMe()
  const who = me.data ?? null
  const demo = isDemoMode()
  const mine = demo ? ROLE_ORDER : rolesOf(who)
  const entries = useMemo(() => allEntries(features), [])
  const [role, setRole] = useState<GuideRole>(() => (demo ? 'student' : defaultRole(who)))
  const [query, setQuery] = useState('')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const results = search(entries, query)

  // Tabs pattern: arrow keys move between roles, Home and End jump to the ends.
  function onTabKey(e: KeyboardEvent, index: number) {
    const last = ROLE_ORDER.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    setRole(ROLE_ORDER[next]!)
    tabs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Guide</h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Everything Coding in Color Learn can do, for each role. Pick a role, or search, and use <strong>Go there</strong> to jump straight to it.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-1">
        <label htmlFor={`${id}-q`} className="font-medium">Search features</label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="For example: notes, reteach, AI tests, certificate"
            className="min-h-11 w-full rounded-md border bg-background py-2 pr-3 pl-9"
          />
        </div>
      </div>

      {query.trim() ? (
        <section aria-labelledby={`${id}-results`} className="flex flex-col gap-3">
          <h2 id={`${id}-results`} className="text-xl font-semibold" aria-live="polite">
            {results.length === 0 ? `Nothing matches "${query.trim()}"` : `${results.length} ${results.length === 1 ? 'feature matches' : 'features match'}`}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {results.map((e) => <li key={e.id}><EntryCard entry={e} mine={mine} showRoles /></li>)}
          </ul>
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Roles" className="flex flex-wrap gap-1 border-b pb-2">
            {ROLE_ORDER.map((r, i) => (
              <button
                key={r}
                ref={(el) => { tabs.current[i] = el }}
                type="button"
                role="tab"
                id={`${id}-tab-${r}`}
                aria-selected={role === r}
                aria-controls={`${id}-panel`}
                tabIndex={role === r ? 0 : -1}
                onClick={() => setRole(r)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${role === r ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {ROLE_INFO[r].label}
                {!demo && mine.includes(r) && <span className={`rounded-full px-1.5 text-xs ${role === r ? 'bg-primary-foreground/20' : 'bg-muted'}`}>you</span>}
              </button>
            ))}
          </div>
          <RolePanel id={`${id}-panel`} labelledBy={`${id}-tab-${role}`} role={role} entries={entries} mine={mine} />
        </>
      )}
    </div>
  )
}

function RolePanel({ id, labelledBy, role, entries, mine }: { id: string; labelledBy: string; role: GuideRole; entries: GuideEntry[]; mine: GuideRole[] }) {
  const { steps, groups } = forRole(entries, role)
  return (
    <section role="tabpanel" id={id} aria-labelledby={labelledBy} className="flex flex-col gap-6">
      <p className="max-w-prose">{ROLE_INFO[role].intro}</p>
      {steps.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Your first steps</h2>
          <ol className="grid gap-3 md:grid-cols-2">
            {steps.map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                <div className="flex-1"><EntryCard entry={e} mine={mine} /></div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{g.name}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {g.items.map((e) => <li key={e.id}><EntryCard entry={e} mine={mine} /></li>)}
          </ul>
        </div>
      ))}
    </section>
  )
}

function EntryCard({ entry, mine, showRoles = false }: { entry: GuideEntry; mine: GuideRole[]; showRoles?: boolean }) {
  const allowed = canUse(entry, mine)
  const linkClass = 'mt-auto inline-flex min-h-11 items-center gap-1 self-start rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90'
  const label = <>Go there <ArrowRight aria-hidden="true" className="size-4" /></>
  const name = `Go there: ${entry.title}`
  return (
    <article className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{entry.title}</h3>
      <p className="text-sm">{entry.summary}</p>
      {entry.howTo && <p className="text-sm text-muted-foreground"><span className="font-medium">Once there:</span> {entry.howTo}</p>}
      {showRoles && <p className="text-xs text-muted-foreground">For: {entry.roles.map((r) => ROLE_INFO[r].label).join(', ')}</p>}
      {!allowed && <p className="text-xs text-muted-foreground">You need the {entry.roles.filter((r) => r !== 'visitor').map((r) => ROLE_INFO[r].label).join(' or ') || 'right'} role for this.</p>}
      {entry.external ? <a className={linkClass} href={entry.to} aria-label={name}>{label}</a> : <Link className={linkClass} to={entry.to} aria-label={name}>{label}</Link>}
    </article>
  )
}
