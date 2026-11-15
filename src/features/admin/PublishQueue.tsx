import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/Dialog'
import { QueryStatus } from '@/components/QueryStatus'
import { listPublished, listSubmitted, ModuleProblems, publishModule, sendBack, type ModuleRow } from './api'

const KEYS = [['admin', 'submitted'], ['admin', 'published']] as const
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '')

/** Modules waiting for review, and what is already published. */
export function PublishQueue() {
  const queryClient = useQueryClient()
  const submitted = useQuery({ queryKey: KEYS[0], queryFn: listSubmitted })
  const published = useQuery({ queryKey: KEYS[1], queryFn: listPublished })
  const [confirming, setConfirming] = useState<ModuleRow | null>(null)
  const refresh = () => Promise.all(KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  const publish = useMutation({ mutationFn: (id: string) => publishModule(id), onSuccess: async () => { setConfirming(null); await refresh() }, onError: (e) => { if (e instanceof ModuleProblems) setConfirming(null) } })
  const back = useMutation({ mutationFn: (id: string) => sendBack(id), onSuccess: refresh })
  const error = publish.error ?? back.error

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="queue-title" className="flex flex-col gap-3">
        <h2 id="queue-title" className="text-xl font-semibold">Waiting for review</h2>
        <div role="alert" className="text-destructive empty:hidden">
          {error instanceof ModuleProblems ? (
            <>
              <p className="font-medium">This module cannot be published yet. Fix these first:</p>
              <ul className="list-disc pl-5">{error.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          ) : error?.message}
        </div>
        <QueryStatus query={submitted} label="the publish queue" isEmpty={(l) => l.length === 0} empty={<p>Nothing is waiting. Submitted modules show up here.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Modules waiting for review</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Title</th><th scope="col" className="p-3">Version</th><th scope="col" className="p-3">Author</th><th scope="col" className="p-3">Created</th><th scope="col" className="p-3">Actions</th></tr></thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className="border-b">
                      <th scope="row" className="p-3 font-medium">{m.title}</th>
                      <td className="p-3">{m.version}</td>
                      <td className="p-3">{m.profiles?.display_name || 'Unknown'}</td>
                      <td className="p-3">{when(m.created_at)}</td>
                      <td className="flex flex-wrap gap-2 p-3">
                        <Button asChild size="sm" variant="outline"><Link to={`/author/${m.id}`} aria-label={`Preview ${m.title}, version ${m.version}`}>Preview</Link></Button>
                        <Button size="sm" aria-label={`Publish ${m.title}, version ${m.version}`} onClick={() => { publish.reset(); setConfirming(m) }}>Publish</Button>
                        <Button size="sm" variant="outline" disabled={back.isPending} aria-label={`Send back ${m.title}, version ${m.version}`} onClick={() => { publish.reset(); back.mutate(m.id) }}>Send back</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryStatus>
      </section>

      <section aria-labelledby="published-title" className="flex flex-col gap-3">
        <h2 id="published-title" className="text-xl font-semibold">Published</h2>
        <QueryStatus query={published} label="published modules" isEmpty={(l) => l.length === 0} empty={<p>No published modules yet.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Published modules</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Title</th><th scope="col" className="p-3">Version</th><th scope="col" className="p-3">Published</th></tr></thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className="border-b"><th scope="row" className="p-3 font-medium">{m.title}</th><td className="p-3">{m.version}</td><td className="p-3">{when(m.published_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryStatus>
      </section>

      <Dialog open={confirming !== null} title={confirming ? `Publish ${confirming.title}?` : ''} onClose={() => setConfirming(null)}>
        <p>Published versions can't be edited. Classes stay on the version they started.</p>
        <div role="alert" className="mt-2 text-destructive empty:hidden">{publish.error && !(publish.error instanceof ModuleProblems) ? publish.error.message : ''}</div>
        <div className="mt-4 flex gap-2">
          <Button disabled={publish.isPending} onClick={() => confirming && publish.mutate(confirming.id)}>{publish.isPending ? 'Publishing…' : 'Publish'}</Button>
          <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  )
}
