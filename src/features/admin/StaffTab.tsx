import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { useMe } from '@/lib/session'
import { inviteStaff, listInvites, listStaff, ROLE_LABEL, setRole, STAFF_ROLES, type StaffRole } from './api'

const KEYS = [['admin', 'invites'], ['admin', 'staff']] as const

function InviteForm({ onDone }: { onDone: () => void }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [role, setRoleValue] = useState<StaffRole>('instructor')
  const [canAuthor, setCanAuthor] = useState(false)
  const [sent, setSent] = useState('')
  const invite = useMutation({
    mutationFn: () => inviteStaff(email.trim(), role, canAuthor),
    onSuccess: () => { setSent(email.trim().toLowerCase()); setEmail(''); onDone() },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setSent(''); invite.mutate() }

  return (
    <form className="flex max-w-xl flex-col gap-3" onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input id={`${id}-email`} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-role`}>Role</Label>
        <select id={`${id}-role`} value={role} onChange={(e) => setRoleValue(e.target.value as StaffRole)} className="min-h-11 rounded-md border bg-background px-3 py-2">
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      {role === 'instructor' && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5" checked={canAuthor} onChange={(e) => setCanAuthor(e.target.checked)} />
          Can author modules
        </label>
      )}
      <p className="text-sm text-muted-foreground">They get this role the first time they sign in with Google using this email.</p>
      <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{invite.error?.message}</div>
      <p role="status" className="text-sm font-medium empty:hidden">{sent ? `Invited ${sent}.` : ''}</p>
      <Button type="submit" className="self-start" disabled={invite.isPending}>{invite.isPending ? 'Inviting…' : 'Send invite'}</Button>
    </form>
  )
}

/** One staff member: role and author switch. Your own row is locked, like the database rule. */
function StaffRow({ id, name, role, canAuthor, mine, onSave, busy }: { id: string; name: string; role: StaffRole; canAuthor: boolean; mine: boolean; busy: boolean; onSave: (id: string, role: StaffRole, canAuthor: boolean) => void }) {
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
    </tr>
  )
}

/** Invite staff, see who has joined, and change roles. */
export function StaffTab() {
  const queryClient = useQueryClient()
  const me = useMe().data
  const invites = useQuery({ queryKey: KEYS[0], queryFn: listInvites })
  const staff = useQuery({ queryKey: KEYS[1], queryFn: listStaff })
  const refresh = () => Promise.all(KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  const change = useMutation({
    mutationFn: ({ id, role, canAuthor }: { id: string; role: StaffRole; canAuthor: boolean }) => setRole(id, role, canAuthor),
    onSuccess: refresh,
  })

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="invite-title" className="flex flex-col gap-3">
        <h2 id="invite-title" className="text-xl font-semibold">Invite someone</h2>
        <InviteForm onDone={() => void refresh()} />
      </section>

      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <h2 id="pending-title" className="text-xl font-semibold">Invitations</h2>
        <QueryStatus query={invites} label="invitations" isEmpty={(l) => l.length === 0} empty={<p>No invitations yet.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Invitations</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Email</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Can author</th><th scope="col" className="p-3">Invited</th><th scope="col" className="p-3">Status</th></tr></thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.email} className="border-b">
                      <th scope="row" className="p-3 font-medium">{i.email}</th>
                      <td className="p-3">{ROLE_LABEL[i.role]}</td>
                      <td className="p-3">{i.can_author ? 'Yes' : 'No'}</td>
                      <td className="p-3">{new Date(i.created_at).toLocaleDateString()}</td>
                      <td className="p-3">{i.accepted_at ? 'Joined' : 'Waiting for first sign-in'}</td>
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
        <div role="alert" className="text-destructive empty:hidden">{change.error?.message}</div>
        <QueryStatus query={staff} label="staff" isEmpty={(l) => l.length === 0} empty={<p>No staff yet. Invite someone above.</p>}>
          {(list) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Staff</caption>
                <thead><tr className="border-b"><th scope="col" className="p-3">Name</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Authoring</th></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <StaffRow key={p.id} id={p.id} name={p.display_name} role={p.role} canAuthor={p.can_author} mine={p.id === me?.profile_id} busy={change.isPending} onSave={(id, role, canAuthor) => change.mutate({ id, role, canAuthor })} />
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
