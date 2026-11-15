import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { listPublishedModules } from './api'

/** `/review`: published modules, searchable by title. */
export function ModuleList() {
  const modules = useQuery({ queryKey: ['review', 'modules'], queryFn: listPublishedModules })
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()

  return (
    <section aria-labelledby="review-modules" className="flex flex-col gap-4">
      <h2 id="review-modules" className="text-2xl font-semibold">Published modules</h2>
      <div className="flex max-w-md flex-col gap-1">
        <Label htmlFor="review-search">Search by title</Label>
        <Input id="review-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <QueryStatus query={modules} label="published modules" isEmpty={(l) => l.length === 0} empty={<p>No published modules yet. They appear here once a CIC admin publishes one.</p>}>
        {(list) => {
          const shown = list.filter((m) => m.title.toLowerCase().includes(term))
          return shown.length === 0 ? (
            <p role="status">No module title matches "{search.trim()}".</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {shown.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 rounded-lg border p-4">
                  <h3 className="text-lg font-semibold">
                    <Link className="underline" to={`/review/${m.id}`}>{m.title}</Link>
                    <span className="ml-2 text-sm font-normal text-muted-foreground">version {m.version}</span>
                  </h3>
                  {m.summary && <p>{m.summary}</p>}
                  <p className="text-sm">{m.lessons} lesson{m.lessons === 1 ? '' : 's'}, {m.activities} activit{m.activities === 1 ? 'y' : 'ies'}</p>
                  <p className="text-sm">Concepts: {m.concepts.length ? m.concepts.join(', ') : 'none tagged'}</p>
                  {m.publishedAt && <p className="text-sm text-muted-foreground">Published {new Date(m.publishedAt).toLocaleDateString()}</p>}
                </li>
              ))}
            </ul>
          )
        }}
      </QueryStatus>
    </section>
  )
}
