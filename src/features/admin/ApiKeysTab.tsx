import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyRow, type ApiScope } from './api'

const KEY = ['admin', 'api-keys'] as const
const SCOPES: { id: ApiScope; label: string; endpoint: string }[] = [
  { id: 'progress', label: 'Completion', endpoint: '/api/v1/completion' },
  { id: 'assessments', label: 'Learning gain', endpoint: '/api/v1/learning-gain' },
]
const scopeNames = (scope: ApiScope[]) => SCOPES.filter((s) => scope.includes(s.id)).map((s) => s.label).join(', ') || 'Nothing'
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'Never')

/** The new key, shown once. Takes focus so a keyboard or screen-reader user lands on it. */
function NewKey({ name, rawKey, onDone }: { name: string; rawKey: string; onDone: () => void }) {
  const uid = useId()
  const box = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState('')
  useEffect(() => box.current?.focus(), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied('Copied.')
    } catch {
      setCopied('Copying is blocked here. Select the key and copy it by hand.')
    }
  }
  return (
    <div ref={box} tabIndex={-1} role="region" aria-labelledby={`${uid}-title`} className="flex flex-col gap-3 rounded-md border border-tint-yellow-edge bg-tint-yellow p-4 text-tint-yellow-fg">
      <h3 id={`${uid}-title`} className="text-lg font-semibold">Copy the key for "{name}" now</h3>
      <p>
        This is the only time it is shown: only a fingerprint of it is stored. Put it in the dashboard's secret settings.
        Never email it or paste it into a chat. If it is lost or seen, revoke it and make a new one.
      </p>
      <Label htmlFor={`${uid}-key`}>API key</Label>
      <Input id={`${uid}-key`} readOnly value={rawKey} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void copy()}>Copy key</Button>
        <Button type="button" variant="outline" onClick={onDone}>Done, I saved it</Button>
        <span role="status" className="text-sm">{copied}</span>
      </div>
      <p className="text-sm">
        The dashboard sends it as <code>Authorization: Bearer &lt;key&gt;</code>. Endpoints and examples are in the{' '}
        <a className="underline" href="/api/docs/" target="_blank" rel="noopener noreferrer">API documentation<span className="sr-only"> (opens in a new tab)</span></a>.
      </p>
    </div>
  )
}

function CreateKey({ onCreated }: { onCreated: (name: string, rawKey: string) => void }) {
  const uid = useId()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ApiScope[]>(['progress', 'assessments'])
  const [problem, setProblem] = useState('')
  const create = useMutation({
    mutationFn: () => createApiKey(name, scope),
    onSuccess: (r) => {
      onCreated(name.trim(), r.raw_key)
      setName('')
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (n.length < 1 || n.length > 100) return setProblem('Give the key a name of 1 to 100 characters, such as "CIC dashboard".')
    if (scope.length === 0) return setProblem('Choose at least one thing the key may read.')
    setProblem('')
    create.mutate()
  }
  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-4 rounded-lg border p-4" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="text-lg font-semibold">Make a key</h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-name`}>Name (who or what will use it)</Label>
        <Input id={`${uid}-name`} value={name} maxLength={100} placeholder="CIC dashboard" onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(problem) && !name.trim()} />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">It may read</legend>
        {SCOPES.map((s) => (
          <label key={s.id} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5" checked={scope.includes(s.id)} onChange={(e) => setScope((now) => (e.target.checked ? [...now, s.id] : now.filter((x) => x !== s.id)))} />
            {s.label} <span className="text-sm">({s.endpoint})</span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm">Every key sees class-level numbers only, never a student's name, and groups under 5 students are hidden.</p>
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{problem || create.error?.message}</p>
      <Button type="submit" className="self-start" disabled={create.isPending}>{create.isPending ? 'Making the key…' : 'Make key'}</Button>
    </form>
  )
}

/** `/admin/keys`: keys for CIC's own systems to call the read API. Make, see and revoke. */
export function ApiKeysTab() {
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: KEY, queryFn: listApiKeys })
  const [fresh, setFresh] = useState<{ name: string; rawKey: string } | null>(null)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)
  const [done, setDone] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY })
  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: async () => {
      setDone(`Revoked "${revoking?.name}". Anything using it gets "A valid API key is required." from now on.`)
      setRevoking(null)
      await refresh()
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="keys-title" className="flex flex-col gap-3">
        <h2 id="keys-title" className="text-xl font-semibold">API keys</h2>
        <p className="text-sm">
          Keys let CIC's own dashboard or spreadsheets read completion and learning gain through the read API.
        </p>
        <p role="status" className="font-medium empty:hidden">{done}</p>
        {fresh ? (
          <NewKey name={fresh.name} rawKey={fresh.rawKey} onDone={() => setFresh(null)} />
        ) : (
          <CreateKey onCreated={(name, rawKey) => { setDone(''); setFresh({ name, rawKey }); void refresh() }} />
        )}
      </section>

      <section aria-labelledby="keys-list-title" className="flex flex-col gap-3">
        <h2 id="keys-list-title" className="text-xl font-semibold">All keys</h2>
        <div role="alert" className="text-destructive empty:hidden">{revoke.error?.message}</div>
        {revoking && (
          <div role="group" aria-label={`Confirm revoking ${revoking.name}`} className="flex flex-col gap-3 rounded-md border border-tint-yellow-edge bg-tint-yellow p-4 text-tint-yellow-fg">
            <p>Revoke <strong>{revoking.name}</strong>? It stops working at once, for anything that uses it. This cannot be undone; make a new key instead.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(revoking.id)}>{revoke.isPending ? 'Revoking…' : 'Yes, revoke it'}</Button>
              <Button type="button" variant="outline" disabled={revoke.isPending} onClick={() => setRevoking(null)}>Cancel</Button>
            </div>
          </div>
        )}
        <QueryStatus query={keys} label="API keys" isEmpty={(l) => l.length === 0} empty={<p>No keys yet. Make one above when CIC's dashboard is ready to connect.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">API keys</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Name</th><th scope="col" className="p-3">May read</th><th scope="col" className="p-3">Made</th><th scope="col" className="p-3">Last used</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Actions</th></tr></thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k.id} className="border-b">
                      <th scope="row" className="p-3 font-medium">{k.name}</th>
                      <td className="p-3">{scopeNames(k.scope)}</td>
                      <td className="p-3">{day(k.created_at)}</td>
                      <td className="p-3">{day(k.last_used_at)}</td>
                      <td className="p-3">{k.revoked_at ? `Revoked ${day(k.revoked_at)}` : 'Active'}</td>
                      <td className="p-3">
                        {k.revoked_at ? <span aria-label="None">-</span> : (
                          <Button type="button" variant="outline" size="sm" disabled={revoke.isPending} onClick={() => { setDone(''); setRevoking(k) }}>
                            Revoke{' '}<span className="sr-only">{k.name}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryStatus>
      </section>
    </div>
  )
}
