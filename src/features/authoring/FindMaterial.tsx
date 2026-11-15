import { useId, useState, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PROGRAMMING_LANGUAGES, SearchRequest, SOURCE_IDS, SOURCES, SPOKEN_LANGUAGES,
  type Problem, type ProgrammingLanguage, type SourceId, type SourceResult, type SpokenLanguage,
} from '@shared/sources/catalog'
import type { ActivityFV } from './formTypes'
import { importReadme, searchSources } from './sourcesApi'

/** The most activities a lesson can hold (authoredLesson in shared/authoring/schemas.ts). */
const MAX_ACTIVITIES = 30

type Props = {
  /** For aria-controls on the button that opens this panel. */
  id: string
  lessonNumber: number
  lessonTitle: string
  activityCount: number
  onAdd: (activity: ActivityFV) => void
}

const select = 'min-h-11 rounded-md border bg-background px-3 py-2'

function problemText(source: SourceId, error: Problem): string {
  const name = SOURCES[source].label
  if (error === 'not_configured') return `${name}: not set up on this site yet. A CIC admin adds a YouTube key (see the deploy guide).`
  if (error === 'quota') return source === 'github' ? 'GitHub is busy. Wait a minute and search again.' : `${name}: the daily search limit is used up. Try again tomorrow, or search GitHub.`
  return `${name} did not answer. Try again.`
}

function duration(s: number | null): string | null {
  if (s === null) return null
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h} h ${m} min` : m ? `${m} min` : `${s} s`
}

/**
 * "Find material" for one lesson: pick a topic, sources and languages, then add a video (embedded,
 * never copied) or an openly licensed GitHub README (copied with its source and license) to the
 * lesson. Additions land in the unsaved draft like any other activity; nothing is saved until the
 * author saves, and a CIC admin reviews the module before students see it.
 */
export function FindMaterial({ id, lessonNumber, lessonTitle, activityCount, onAdd }: Props) {
  const uid = useId()
  const [topic, setTopic] = useState(lessonTitle)
  const [sources, setSources] = useState<SourceId[]>(['youtube', 'github'])
  const [spoken, setSpoken] = useState<SpokenLanguage>('en')
  const [language, setLanguage] = useState<ProgrammingLanguage>('any')
  const [ccOnly, setCcOnly] = useState(false)
  const [formError, setFormError] = useState('')
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const search = useMutation({ mutationFn: searchSources, onSuccess: (r) => setAnnouncement(r.results.length ? `Found ${r.results.length} results.` : 'Nothing found.') })
  const full = activityCount >= MAX_ACTIVITIES

  const run = () => {
    const parsed = SearchRequest.safeParse({ topic, sources, spokenLanguage: spoken, programmingLanguage: language, creativeCommonsOnly: ccOnly })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the search.')
      return
    }
    setFormError('')
    setAnnouncement('')
    search.mutate(parsed.data)
  }
  // The panel sits inside the module form: Enter must search here, not save the module.
  const onTopicKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    run()
  }
  const toggle = (s: SourceId, on: boolean) => setSources((now) => (on ? SOURCE_IDS.filter((x) => x === s || now.includes(x)) : now.filter((x) => x !== s)))

  const done = (r: SourceResult, kind: string) => {
    setAdded((a) => ({ ...a, [`${r.source}:${r.id}`]: true }))
    setAnnouncement(`Added "${r.title}" to lesson ${lessonNumber} as a ${kind}. Save the draft to keep it.`)
  }
  const add = async (r: SourceResult) => {
    setImportError('')
    if (r.kind === 'video') {
      onAdd({ kind: 'video', title: r.title.slice(0, 120), required: true, youtubeUrl: r.url, transcript: '' })
      done(r, 'video')
      return
    }
    setImporting(r.id)
    try {
      const reading = await importReadme(r.id)
      onAdd({ kind: 'reading', title: reading.title, required: true, body: reading.body })
      done(r, 'reading')
    } catch (e) {
      setImportError((e as Error).message)
    } finally {
      setImporting(null)
    }
  }

  const results = search.data?.results ?? []
  const groups = SOURCE_IDS.map((s) => ({ source: s, items: results.filter((r) => r.source === s) })).filter((g) => g.items.length > 0)

  return (
    <section id={id} aria-labelledby={`${uid}-heading`} className="flex flex-col gap-4 rounded-lg border-2 border-dashed p-4">
      <div className="flex flex-col gap-1">
        <h4 id={`${uid}-heading`} className="font-semibold">Find material for lesson {lessonNumber}</h4>
        <p className="text-sm">
          Videos are embedded without tracking cookies, never copied. GitHub READMEs are copied only when the
          repository has an open license, with a link back. Check what you add: a CIC admin reviews the module before students see it.
        </p>
      </div>

      <div role="search" aria-label={`Find material for lesson ${lessonNumber}`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${uid}-topic`}>Topic</Label>
          <Input id={`${uid}-topic`} value={topic} maxLength={100} onChange={(e) => setTopic(e.target.value)} onKeyDown={onTopicKey} aria-describedby={`${uid}-topic-help`} aria-invalid={Boolean(formError)} />
          <p id={`${uid}-topic-help`} className="text-sm">For example "for loops" or "CSS flexbox". Press Enter to search.</p>
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Search in</legend>
          <div className="flex flex-wrap gap-x-6">
            {SOURCE_IDS.map((s) => (
              <label key={s} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5" checked={sources.includes(s)} onChange={(e) => toggle(s, e.target.checked)} />
                {SOURCES[s].label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-spoken`}>Language of the material</Label>
            <select id={`${uid}-spoken`} className={select} value={spoken} onChange={(e) => setSpoken(e.target.value as SpokenLanguage)}>
              {Object.entries(SPOKEN_LANGUAGES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-language`}>Programming language</Label>
            <select id={`${uid}-language`} className={select} value={language} onChange={(e) => setLanguage(e.target.value as ProgrammingLanguage)}>
              {Object.entries(PROGRAMMING_LANGUAGES).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5" checked={ccOnly} onChange={(e) => setCcOnly(e.target.checked)} />
            Creative Commons videos only
          </label>
          <Button type="button" onClick={run} disabled={search.isPending}>{search.isPending ? 'Searching…' : 'Search'}</Button>
        </div>
      </div>

      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{formError || search.error?.message || importError}</p>
      <p role="status" className="text-sm empty:hidden">{announcement}</p>
      {full && <p className="text-sm font-medium">This lesson has {MAX_ACTIVITIES} activities, the most it can hold. Remove one to add more.</p>}

      {search.data && search.data.problems.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-tint-yellow-edge bg-tint-yellow p-3 text-sm text-tint-yellow-fg">
          {search.data.problems.map((p) => <li key={p.source}>{problemText(p.source, p.error)}</li>)}
        </ul>
      )}
      {search.isSuccess && results.length === 0 && (
        <p className="text-sm">Nothing found for "{search.variables?.topic.trim()}". Try fewer words, another language, or more sources.</p>
      )}

      {groups.map((g) => (
        <section key={g.source} aria-labelledby={`${uid}-${g.source}`} className="flex flex-col gap-2">
          <h5 id={`${uid}-${g.source}`} className="font-semibold">{SOURCES[g.source].label} ({g.items.length})</h5>
          <ul className="flex flex-col gap-2">
            {g.items.map((r) => {
              const isAdded = added[`${r.source}:${r.id}`] === true
              const action = r.kind === 'video' ? 'Add as video' : 'Add README as reading'
              const meta = [r.by, r.kind === 'video' ? duration(r.durationS) : `${(r.stars ?? 0).toLocaleString()} stars`].filter(Boolean).join(' · ')
              return (
                <li key={r.id} className="flex gap-3 rounded-md border p-3">
                  {r.thumbnail && <img src={r.thumbnail} alt="" width={160} height={90} loading="lazy" className="hidden aspect-video w-40 shrink-0 rounded object-cover sm:block" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium break-words underline underline-offset-4">
                      {r.title}{' '}<span className="sr-only">(opens in a new tab)</span>
                    </a>
                    {meta && <p className="text-sm">{meta}</p>}
                    {r.description && <p className="line-clamp-2 text-sm break-words">{r.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${r.license.open ? 'border-emerald-700 text-emerald-900' : ''}`}>{r.license.name}</span>
                      <Button
                        type="button" size="sm" variant="outline"
                        aria-label={isAdded ? `Added: ${r.title}` : `${action}: ${r.title}`}
                        disabled={isAdded || full || importing !== null}
                        onClick={() => void add(r)}
                      >
                        {isAdded ? 'Added' : importing === r.id ? 'Importing…' : action}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </section>
  )
}
