import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { addSchool, listSchools } from './api'

/** Schools. Instructors can only create classes at a school that exists, so adding one unblocks them. */
export function SchoolsTab() {
  const id = useId()
  const queryClient = useQueryClient()
  const schools = useQuery({ queryKey: ['admin', 'schools'], queryFn: listSchools })
  const [name, setName] = useState('')
  const [added, setAdded] = useState('')
  const add = useMutation({
    mutationFn: (n: string) => addSchool(n),
    onSuccess: async (_d, n) => { setAdded(n.trim()); setName(''); await queryClient.invalidateQueries({ queryKey: ['admin', 'schools'] }) },
  })
  const submit = (e: FormEvent) => { e.preventDefault(); setAdded(''); add.mutate(name) }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${id}-add`} className="flex max-w-xl flex-col gap-3">
        <h2 id={`${id}-add`} className="text-xl font-semibold">Add a school</h2>
        <p className="text-sm text-muted-foreground">Instructors can only create classes at a school that already exists.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit} noValidate>
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-name`}>School name</Label>
            <Input id={`${id}-name`} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" disabled={add.isPending}>{add.isPending ? 'Adding…' : 'Add school'}</Button>
        </form>
        <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{add.error?.message}</div>
        <p role="status" className="text-sm font-medium empty:hidden">{added ? `Added ${added}.` : ''}</p>
      </section>
      <section aria-labelledby={`${id}-list`} className="flex flex-col gap-3">
        <h2 id={`${id}-list`} className="text-xl font-semibold">Schools</h2>
        <QueryStatus query={schools} label="schools" isEmpty={(l) => l.length === 0} empty={<p>No schools yet. Add the first one above.</p>}>
          {(list) => (
            <ul className="flex flex-col gap-1">
              {list.map((s) => <li key={s.id}>{s.name} <span className="text-sm text-muted-foreground">(added {new Date(s.created_at).toLocaleDateString()})</span></li>)}
            </ul>
          )}
        </QueryStatus>
      </section>
    </div>
  )
}
