import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { QueryStatus } from '@/components/QueryStatus'
import { listClassModules, listPlacements, setStartModule, type ClassModule } from './setupApi'

import { classModulesKey, placementsKey, selectClass } from './placement'

const BEGINNING = ''

/** "From the beginning" plus the class's modules, in class order. */
export function ModuleOptions({ modules }: { modules: ClassModule[] }) {
  return (
    <>
      <option value={BEGINNING}>From the beginning</option>
      {modules.slice(1).map((m, i) => (
        <option key={m.moduleId} value={m.moduleId}>
          Module {i + 2}: {m.title}
        </option>
      ))}
    </>
  )
}

/**
 * Late joiners: where each student starts. Choosing module N skips the modules before it for
 * that student only (they stay open to review). Works before the student has signed in.
 */
export function StartingPoint({ classId }: { classId: string }) {
  const id = useId()
  const queryClient = useQueryClient()
  const modules = useQuery({ queryKey: classModulesKey(classId), queryFn: () => listClassModules(classId) })
  const placements = useQuery({
    // Keyed on the module list too: assigning a module changes where "the beginning" is.
    queryKey: [...placementsKey(classId), modules.data?.map((m) => m.moduleId).join(',')],
    queryFn: () => listPlacements(classId, modules.data ?? []),
    enabled: (modules.data?.length ?? 0) > 1, // nothing to place with fewer than two modules
  })
  const [memberId, setMemberId] = useState('')
  const [moduleId, setModuleId] = useState(BEGINNING)
  const save = useMutation({
    mutationFn: () => setStartModule([memberId], moduleId || null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: placementsKey(classId) }),
  })

  const titleOf = (start: string | null) => {
    const i = start ? (modules.data ?? []).findIndex((x) => x.moduleId === start) : -1
    return i >= 0 ? `Module ${i + 1}: ${modules.data![i]!.title}` : 'From the beginning'
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div>
        <h2 id={`${id}-title`} className="text-xl font-semibold">Starting point</h2>
        <p className="text-sm text-muted-foreground">
          Joining late? Start a student at a later module. The modules before it are skipped for them only,
          and stay open if they want to look back.
        </p>
      </div>
      <QueryStatus
        query={modules}
        label="this class's modules"
        isEmpty={(l) => l.length < 2}
        empty={<p>Assign at least two modules to choose a later starting point.</p>}
      >
        {(mods) => (
          <QueryStatus query={placements} label="the roster" isEmpty={(l) => l.length === 0} empty={<p>Import a roster first.</p>}>
            {(seats) => (
              <div className="flex flex-col gap-4">
                <form
                  className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (memberId) save.mutate()
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${id}-student`}>Student</Label>
                    <select id={`${id}-student`} className={selectClass} value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                      <option value="" disabled>Choose a student</option>
                      {seats.map((s) => (
                        <option key={s.memberId} value={s.memberId}>{s.name}{s.joined ? '' : ' (not signed in yet)'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${id}-module`}>Starts at</Label>
                    <select id={`${id}-module`} className={selectClass} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                      <ModuleOptions modules={mods} />
                    </select>
                  </div>
                  <Button type="submit" disabled={!memberId || save.isPending}>
                    {save.isPending ? 'Saving…' : 'Save starting point'}
                  </Button>
                </form>
                <div role="status" className="text-sm empty:hidden">
                  {save.isSuccess && `Saved. ${save.data.skipped_modules === 0 ? 'They start from the beginning.' : `${save.data.skipped_modules} earlier module${save.data.skipped_modules === 1 ? '' : 's'} skipped.`}`}
                </div>
                <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{save.error?.message}</div>
                {seats.some((s) => s.startModuleId) && (
                  <div>
                    <h3 className="mb-2 font-semibold">Placed at a later module</h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {seats.filter((s) => s.startModuleId).map((s) => (
                        <li key={s.memberId}>
                          <span className="font-medium">{s.name}</span> <span aria-hidden="true">→</span>
                          <span className="sr-only">starts at</span> {titleOf(s.startModuleId)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </QueryStatus>
        )}
      </QueryStatus>
    </section>
  )
}
