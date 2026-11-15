import { useId } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { QueryStatus } from './QueryStatus'
import { assignModule, listClassModules, listPublishedModules } from './setupApi'

/** What the class already has, and the published modules an instructor can add to it. */
export function AssignModule({ classId }: { classId: string }) {
  const id = useId()
  const queryClient = useQueryClient()
  const assigned = useQuery({ queryKey: ['instructor', 'class-modules', classId], queryFn: () => listClassModules(classId) })
  const published = useQuery({ queryKey: ['instructor', 'published-modules'], queryFn: listPublishedModules })
  const assign = useMutation({
    mutationFn: (moduleId: string) => assignModule(classId, moduleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instructor', 'class-modules', classId] }),
  })
  const have = new Set(assigned.data?.map((m) => m.moduleId))

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2 id={`${id}-title`} className="text-xl font-semibold">Modules</h2>
      <div>
        <h3 className="mb-2 font-semibold">In this class</h3>
        <QueryStatus query={assigned} label="this class's modules" isEmpty={(l) => l.length === 0} empty={<p>No modules assigned yet.</p>}>
          {(list) => (
            <ol className="list-decimal pl-6">
              {list.map((m) => <li key={m.moduleId}>{m.title} <span className="text-sm text-muted-foreground">(version {m.version})</span></li>)}
            </ol>
          )}
        </QueryStatus>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Published modules</h3>
        <QueryStatus
          query={published}
          label="published modules"
          isEmpty={(l) => l.length === 0}
          empty={<p>No published modules yet. A CIC admin publishes modules from the Authoring studio.</p>}
        >
          {(list) => (
            <ul className="flex flex-col gap-2">
              {list.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <span>{m.title} <span className="text-sm text-muted-foreground">(version {m.version})</span></span>
                  {have.has(m.id) ? (
                    <span className="text-sm font-medium">Assigned</span>
                  ) : (
                    <Button size="sm" disabled={assign.isPending} aria-label={`Assign ${m.title}, version ${m.version}`} onClick={() => assign.mutate(m.id)}>
                      Assign
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryStatus>
        <div role="alert" className="mt-2 text-sm font-medium text-destructive empty:hidden">{assign.error?.message}</div>
      </div>
    </section>
  )
}
