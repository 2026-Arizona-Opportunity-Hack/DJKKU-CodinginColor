import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { useMe } from '@/lib/session'
import { cancelInvite, listInvites, listStaff, previewRemoval, removeStaff, ROLE_LABEL, setRole, STAFF_ROLES, type Removal, type StaffRole } from './api'

const KEYS = [['admin', 'invites'], ['admin', 'staff']] as const

/** One staff member: role, author switch and Remove. Your own row is locked, like the database rule. */
function StaffRow({ id, name, role, canAuthor, mine, onSave, onRemove, busy }: { id: string; name: string; role: StaffRole; canAuthor: boolean; mine: boolean; busy: boolean; onSave: (id: string, role: StaffRole, canAuthor: boolean) => void; onRemove: () => void }) {
  const uid = useId()
  return (
    <tr className="border-b">
      <th scope="row" className="p-3 font-medium">{name || '(no name yet)'}{mine && <span className="ml-2 text-sm font-normal">(you)</span>}</th>
      <td className="p-3">
        <Label htmlFor={`${uid}-role`} className="sr-only">Role for {name || 'this person'}</Label>
        <select id={`${uid}-role`} disabled={mine || busy} value={role} onChange={(e) => onSave(id, e.target.value as StaffRole, canAuthor)} className="min-h-11 rounded-md border bg-background px-3 py-2">
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {mine && <p className="text-xs">You can't change your own role.</p>}
      </td>
      <td className="p-3">
        {role === 'instructor' ? (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5" disabled={mine || busy} checked={canAuthor} onChange={(e) => onSave(id, role, e.target.checked)} />
            Can author<span className="sr-only"> ({name || 'this person'})</span>
          </label>
        ) : <span aria-label="Not applicable">-</span>}
      </td>
      <td className="p-3">
        {mine ? <span aria-label="Not available for yourself">-</span> : (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRemove}>
            Remove access{' '}<span className="sr-only">for {name || 'this person'}</span>
          </Button>
        )}
      </td>
    </tr>
  )
}

/** Asks before something that cannot be undone with one click. Takes focus so keyboard users land on it. */
function Confirm({ label, children, yes, busy, onYes, onCancel }: { label: string; children: ReactNode; yes: string; busy: boolean; onYes: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-label={label} className="flex flex-col gap-3 rounded-md border border-tint-yellow-edge bg-tint-yellow p-4 text-tint-yellow-fg">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={busy} onClick={onYes}>{busy ? 'Working…' : yes}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/** Invite staff, see who has joined, change roles, remove access and cancel unused invites. */
export function StaffTab() {
  const queryClient = useQueryClient()
  const me = useMe().data
  const invites = useQuery({ queryKey: KEYS[0], queryFn: listInvites })
  const staff = useQuery({ queryKey: KEYS[1], queryFn: listStaff })
  const refresh = () => Promise.all(KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  const [done, setDone] = useState('')
  const change = useMutation({
    mutationFn: ({ id, role, canAuthor }: { id: string; role: StaffRole; canAuthor: boolean }) => setRole(id, role, canAuthor),
    onSuccess: refresh,
  })

  // Remove access: first ask the database what it would do (classes left without an instructor), then confirm.
  const [removing, setRemoving] = useState<{ id: string; name: string; preview: Removal } | null>(null)
  const preview = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => ({ id, name, preview: await previewRemoval(id) }),
    onMutate: () => setDone(''),
    onSuccess: setRemoving,
  })
  const remove = useMutation({
    mutationFn: (id: string) => removeStaff(id),
    onSuccess: async () => {
      setDone(`Removed staff access for ${removing?.name || 'that person'}. Inviting the same email again gives it back.`)
      setRemoving(null)
      await refresh()
    },
  })

  const [cancelling, setCancelling] = useState<string | null>(null)
  const cancel = useMutation({
    mutationFn: (email: string) => cancelInvite(email),
    onMutate: () => setDone(''),
    onSuccess: async (_r, email) => {
      setDone(`Cancelled the invite for ${email}.`)
      setCancelling(null)
      await refresh()
    },
  })

  const busy = change.isPending || preview.isPending || remove.isPending || cancel.isPending
  const orphaned = removing?.preview.classes_left_without_instructor ?? []

  return (
    <div className="flex flex-col gap-8">
      <p role="status" className="font-medium empty:hidden">{done}</p>

      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <h2 id="pending-title" className="text-xl font-semibold">Invitations</h2>
        <p className="text-sm">To invite someone, use the form on the <Link className="underline" to="/admin/overview">Overview</Link> tab. They get the role the first time they sign in with Google using that email.</p>
        <div role="alert" className="text-destructive empty:hidden">{cancel.error?.message}</div>
        {cancelling && (
          <Confirm label="Confirm cancelling the invite" yes="Yes, cancel the invite" busy={cancel.isPending} onYes={() => cancel.mutate(cancelling)} onCancel={() => setCancelling(null)}>
            <p>Cancel the invite for <strong>{cancelling}</strong>? Signing in with that email will no longer give a staff role.</p>
          </Confirm>
        )}
        <QueryStatus query={invites} label="invitations" isEmpty={(l) => l.length === 0} empty={<p>No invitations yet.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Invitations</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Email</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Can author</th><th scope="col" className="p-3">Invited</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Actions</th></tr></thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.email} className="border-b">
                      <th scope="row" className="p-3 font-medium">{i.email}</th>
                      <td className="p-3">{ROLE_LABEL[i.role]}</td>
                      <td className="p-3">{i.can_author ? 'Yes' : 'No'}</td>
                      <td className="p-3">{new Date(i.created_at).toLocaleDateString()}</td>
                      <td className="p-3">{i.accepted_at ? 'Joined' : 'Waiting for first sign-in'}</td>
                      <td className="p-3">
                        {i.accepted_at ? <span aria-label="None: to take access away, remove them under Staff">-</span> : (
                          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setDone(''); setCancelling(i.email) }}>
                            Cancel invite{' '}<span className="sr-only">for {i.email}</span>
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

      <section aria-labelledby="staff-title" className="flex flex-col gap-3">
        <h2 id="staff-title" className="text-xl font-semibold">Staff</h2>
        <div role="alert" className="text-destructive empty:hidden">{change.error?.message ?? preview.error?.message ?? remove.error?.message}</div>
        {removing && (
          <Confirm label={`Confirm removing ${removing.name || 'this person'}`} yes="Yes, remove access" busy={remove.isPending} onYes={() => remove.mutate(removing.id)} onCancel={() => setRemoving(null)}>
            <p>
              Remove <strong>{removing.name || 'this person'}</strong>'s staff access? They lose every staff screen at once and are taken off
              the classes they teach. Their account, the modules they wrote and their history stay. Inviting the same email again gives access back.
            </p>
            {orphaned.length > 0 && (
              <div>
                <p className="font-medium">These classes will have no instructor:</p>
                <ul className="list-disc pl-6">{orphaned.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
                <p>Students keep learning. Add a new instructor under Class staffing on the Overview tab.</p>
              </div>
            )}
          </Confirm>
        )}
        <QueryStatus query={staff} label="staff" isEmpty={(l) => l.length === 0} empty={<p>No staff yet.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Staff</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Name</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Authoring</th><th scope="col" className="p-3">Access</th></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <StaffRow
                      key={p.id} id={p.id} name={p.display_name} role={p.role} canAuthor={p.can_author} mine={p.id === me?.profile_id} busy={busy}
                      onSave={(id, role, canAuthor) => change.mutate({ id, role, canAuthor })}
                      onRemove={() => preview.mutate({ id: p.id, name: p.display_name })}
                    />
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
