import { useId, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { assignMentor, listMentors, listOpenStudents } from './api'

function Assign({ mentorId, name, students }: { mentorId: string; name: string; students: { profile_id: string; display_name: string }[] }) {
  const id = useId()
  const [pick, setPick] = useState('')
  const [done, setDone] = useState('')
  const assign = useMutation({ mutationFn: () => assignMentor(mentorId, pick), onSuccess: () => { setDone(students.find((s) => s.profile_id === pick)?.display_name ?? 'Student'); setPick('') } })
  return (
    <li className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <span className="min-w-40 font-medium">{name || '(no name yet)'}</span>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-xs">Student for {name || 'this mentor'}</Label>
        <select id={id} value={pick} onChange={(e) => { setDone(''); setPick(e.target.value) }} className="min-h-11 rounded-md border bg-background px-2">
          <option value="">Choose a student</option>
          {students.map((s) => <option key={s.profile_id} value={s.profile_id}>{s.display_name}</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" disabled={!pick || assign.isPending} aria-label={`Assign student to ${name || 'mentor'}`} onClick={() => assign.mutate()}>Assign student</Button>
      <p role="alert" className="basis-full text-sm font-medium text-destructive empty:hidden">{assign.error?.message}</p>
      <p role="status" className="basis-full text-sm empty:hidden">{done ? `${done} assigned.` : ''}</p>
    </li>
  )
}

/** Mentors see only the students an admin assigns them. For now: students in CIC Open. */
export function MentorsTab() {
  const mentors = useQuery({ queryKey: ['admin', 'mentors'], queryFn: listMentors })
  const students = useQuery({ queryKey: ['admin', 'open-students'], queryFn: listOpenStudents })
  return (
    <section aria-labelledby="mentors-title" className="flex flex-col gap-3">
      <h2 id="mentors-title" className="text-xl font-semibold">Mentors</h2>
      <QueryStatus query={mentors} label="mentors" isEmpty={(l) => l.length === 0} empty={<p>No mentors yet. Invite one on the Staff tab.</p>}>
        {(list) => (
          <QueryStatus query={students} label="CIC Open students" isEmpty={(l) => l.length === 0} empty={<p>No CIC Open students to assign yet.</p>}>
            {(s) => <ul className="flex flex-col gap-2">{list.map((m) => <Assign key={m.id} mentorId={m.id} name={m.display_name} students={s} />)}</ul>}
          </QueryStatus>
        )}
      </QueryStatus>
    </section>
  )
}
