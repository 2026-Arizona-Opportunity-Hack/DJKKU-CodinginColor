import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { addInstructor, listClasses, listStaff, removeInstructor, type ClassSummary } from './api'

const KEY = ['admin', 'classes'] as const

function AddInstructor({ cls, people, busy, onAdd }: { cls: ClassSummary; people: { id: string; name: string }[]; busy: boolean; onAdd: (profileId: string) => void }) {
  const id = useId()
  const [pick, setPick] = useState('')
  const available = people.filter((p) => !cls.instructors.some((i) => i.profileId === p.id))
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-xs">Person to add to {cls.name}</Label>
        <select id={id} value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-11 rounded-md border bg-background px-2">
          <option value="">Choose a person</option>
          {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" disabled={!pick || busy} aria-label={`Add instructor to ${cls.name}`} onClick={() => { onAdd(pick); setPick('') }}>Add instructor</Button>
    </div>
  )
}

/** Every class, who teaches it, and a way to staff it. Opening one goes to the instructor view. */
export function ClassesTab() {
  const queryClient = useQueryClient()
  const classes = useQuery({ queryKey: KEY, queryFn: listClasses })
  const staff = useQuery({ queryKey: ['admin', 'staff'], queryFn: listStaff })
  const people = (staff.data ?? []).filter((p) => p.role === 'instructor' || p.role === 'cic_admin').map((p) => ({ id: p.id, name: p.display_name || '(no name yet)' }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY })
  const add = useMutation({ mutationFn: ({ c, p }: { c: string; p: string }) => addInstructor(c, p), onSuccess: refresh })
  const remove = useMutation({ mutationFn: ({ c, p }: { c: string; p: string }) => removeInstructor(c, p), onSuccess: refresh })
  const error = add.error ?? remove.error

  return (
    <section aria-labelledby="classes-title" className="flex flex-col gap-3">
      <h2 id="classes-title" className="text-xl font-semibold">All classes</h2>
      <div role="alert" className="text-destructive empty:hidden">{error?.message}</div>
      <QueryStatus query={classes} label="classes" isEmpty={(l) => l.length === 0} empty={<p>No classes yet. Instructors create them at <Link className="underline" to="/instructor/new">Instructor home</Link>.</p>}>
        {(list) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">All classes</caption>
              <thead><tr className="border-b">{['Class', 'School', 'Instructors', 'Students', 'Completion', 'Actions'].map((h) => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b align-top">
                    <th scope="row" className="p-3 font-medium">{c.name}{c.term ? ` - ${c.term}` : ''}{c.kind === 'open' && <span className="ml-2 text-sm font-normal">(open)</span>}</th>
                    <td className="p-3">{c.school}</td>
                    <td className="p-3">
                      {c.instructors.length === 0 && <span>None yet</span>}
                      <ul className="flex flex-col gap-1">
                        {c.instructors.map((i) => (
                          <li key={i.profileId} className="flex items-center gap-1">
                            {i.name}
                            <Button size="icon" variant="ghost" aria-label={`Remove ${i.name} from ${c.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ c: c.id, p: i.profileId })}><X aria-hidden="true" /></Button>
                          </li>
                        ))}
                      </ul>
                      <AddInstructor cls={c} people={people} busy={add.isPending} onAdd={(p) => add.mutate({ c: c.id, p })} />
                    </td>
                    <td className="p-3">{c.students}</td>
                    <td className="p-3">{c.completionPct === null ? 'No students' : `${Math.round(c.completionPct)}%`}</td>
                    <td className="p-3"><Button asChild size="sm" variant="outline"><Link to={`/instructor/${c.id}`} aria-label={`Open ${c.name}`}>Open</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryStatus>
    </section>
  )
}
