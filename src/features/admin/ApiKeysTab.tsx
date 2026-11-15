import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/Dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { API_SCOPES, createKey, listKeys, revokeKey, type ApiKey } from './api'

const KEY = ['admin', 'keys'] as const
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')

/** The new key, shown once. It lives only in this dialog's mutation result and is dropped on close. */
function NewKeyDialog({ rawKey, onClose }: { rawKey: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState('')
  const curl = `curl -H "Authorization: Bearer ${rawKey}" ${window.location.origin}/api/v1/completion`
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(`${what} copied.`) } catch { setCopied("Couldn't copy. Select the text and copy it yourself.") }
  }
  return (
    <Dialog open={rawKey !== null} title="Your new API key" onClose={() => { setCopied(''); onClose() }}>
      <p className="font-medium">This key is shown once. Store it somewhere safe.</p>
      <p className="my-3 rounded-md bg-muted p-3 font-mono break-all">{rawKey}</p>
      <p className="text-sm">Try it:</p>
      <pre className="my-1 overflow-x-auto rounded-md bg-muted p-3 text-sm break-all whitespace-pre-wrap">{curl}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copy(rawKey ?? '', 'Key')}>Copy key</Button>
        <Button variant="outline" onClick={() => void copy(curl, 'Example')}>Copy example</Button>
        <Button onClick={() => { setCopied(''); onClose() }}>Done</Button>
      </div>
      <p role="status" className="mt-2 text-sm empty:hidden">{copied}</p>
    </Dialog>
  )
}

/** Keys for CIC's own dashboard. Create one (shown once), see when it was used, revoke it. */
export function ApiKeysTab() {
  const id = useId()
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: KEY, queryFn: listKeys })
  const [name, setName] = useState('')
  const [scope, setScope] = useState<string[]>(['progress'])
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const create = useMutation({ mutationFn: () => createKey(name, scope), onSuccess: async () => { setName(''); await queryClient.invalidateQueries({ queryKey: KEY }) } })
  const revoke = useMutation({ mutationFn: (k: string) => revokeKey(k), onSuccess: async () => { setRevoking(null); await queryClient.invalidateQueries({ queryKey: KEY }) } })
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate() }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${id}-new`} className="flex max-w-xl flex-col gap-3">
        <h2 id={`${id}-new`} className="text-xl font-semibold">Create a key</h2>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="CIC dashboard" />
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-medium">What it can read</legend>
            {API_SCOPES.map((s) => (
              <label key={s.value} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5" checked={scope.includes(s.value)} onChange={(e) => setScope(e.target.checked ? [...scope, s.value] : scope.filter((x) => x !== s.value))} />
                {s.label} <span className="text-sm text-muted-foreground">({s.path})</span>
              </label>
            ))}
          </fieldset>
          <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{create.error?.message}</div>
          <Button type="submit" className="self-start" disabled={create.isPending || scope.length === 0}>{create.isPending ? 'Creating…' : 'Create key'}</Button>
        </form>
      </section>

      <section aria-labelledby={`${id}-list`} className="flex flex-col gap-3">
        <h2 id={`${id}-list`} className="text-xl font-semibold">Keys</h2>
        <div role="alert" className="text-destructive empty:hidden">{revoke.error && revoking === null ? revoke.error.message : ''}</div>
        <QueryStatus query={keys} label="API keys" isEmpty={(l) => l.length === 0} empty={<p>No API keys yet.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">API keys</caption>
                <thead><tr className="border-b">{['Name', 'Can read', 'Created', 'Last used', 'Status', 'Actions'].map((h) => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k.id} className="border-b">
                      <th scope="row" className="p-3 font-medium">{k.name}</th>
                      <td className="p-3">{k.scope.join(', ') || 'Nothing'}</td>
                      <td className="p-3">{date(k.created_at)}</td>
                      <td className="p-3">{date(k.last_used_at)}</td>
                      <td className="p-3">{k.revoked_at ? `Revoked ${date(k.revoked_at)}` : 'Active'}</td>
                      <td className="p-3">{!k.revoked_at && <Button size="sm" variant="outline" aria-label={`Revoke ${k.name}`} onClick={() => { revoke.reset(); setRevoking(k) }}>Revoke</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryStatus>
      </section>

      <NewKeyDialog rawKey={create.data?.raw_key ?? null} onClose={() => create.reset()} />
      <Dialog open={revoking !== null} title={revoking ? `Revoke ${revoking.name}?` : ''} onClose={() => setRevoking(null)}>
        <p>Anything using this key stops working right away. This can't be undone.</p>
        <div role="alert" className="mt-2 text-destructive empty:hidden">{revoke.error?.message}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="destructive" disabled={revoke.isPending} onClick={() => revoking && revoke.mutate(revoking.id)}>Revoke key</Button>
          <Button variant="outline" onClick={() => setRevoking(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  )
}
