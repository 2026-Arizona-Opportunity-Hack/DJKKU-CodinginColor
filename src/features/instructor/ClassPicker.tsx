import { Link, useMatch, useNavigate } from 'react-router'
import { Label } from '@/components/ui/label'
import { useClasses } from './hooks'
import { QueryStatus } from './QueryStatus'

/** The class lives in the URL (/instructor/:classId), so a refresh or a shared link keeps it. */
export function ClassPicker() {
  const classes = useClasses()
  const navigate = useNavigate()
  const selected = useMatch('/instructor/:classId/*')?.params.classId

  return (
    <QueryStatus
      query={classes}
      label="your classes"
      isEmpty={(list) => list.length === 0}
      empty={
        <p>
          You don't teach any classes yet. <Link className="underline" to="/instructor/new">Create one</Link>, or ask a CIC admin to add you to one.
        </p>
      }
    >
      {(list) => (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="class-picker">Class</Label>
            <select
              id="class-picker"
              value={list.find((c) => c.id === selected)?.id ?? ''}
              onChange={(e) => navigate(`/instructor/${e.target.value}`)}
              className="mt-1 block min-h-11 w-full min-w-64 rounded-md border bg-background px-3 py-2"
            >
              <option value="" disabled>Choose a class</option>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.term ? ` - ${c.term}` : ''}
                </option>
              ))}
            </select>
          </div>
          <Link className="inline-flex min-h-11 items-center underline" to="/instructor/new">New class</Link>
        </div>
      )}
    </QueryStatus>
  )
}
