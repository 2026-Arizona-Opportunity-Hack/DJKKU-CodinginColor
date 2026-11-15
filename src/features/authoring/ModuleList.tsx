import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { listMyModules, newVersion, type ModuleSummary } from './api'
import { modulesKey } from './keys'

const STATUS: Record<ModuleSummary['status'], string> = { draft: 'Draft', submitted: 'Submitted', published: 'Published' }

/** `/author`: your modules, with a way to start one, edit a draft or copy a published one. */
export function ModuleList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const modules = useQuery({ queryKey: modulesKey, queryFn: listMyModules })
  const copy = useMutation({
    mutationFn: (id: string) => newVersion(id),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: modulesKey })
      navigate(`/author/${id}`)
    },
  })

  return (
    <section aria-labelledby="my-modules" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-modules" className="text-2xl font-semibold">My modules</h2>
        <Button asChild><Link to="/author/new">New module</Link></Button>
      </div>
      <div role="alert" className="text-destructive empty:hidden">{copy.error?.message}</div>

      {modules.isPending ? (
        <p role="status">Loading your modules…</p>
      ) : modules.isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-red-700">
          <p>We could not load your modules. {modules.error.message}</p>
          <Button variant="outline" onClick={() => void modules.refetch()}>Try again</Button>
        </div>
      ) : modules.data.length === 0 ? (
        <p>No modules yet. <Link className="underline" to="/author/new">Start one.</Link></p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Your modules</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-3">Title</th>
                <th scope="col" className="p-3">Version</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modules.data.map((m) => (
                <tr key={m.id} className="border-b">
                  <th scope="row" className="p-3 font-medium">{m.title}</th>
                  <td className="p-3">{m.version}</td>
                  <td className="p-3"><span className="rounded-full border px-2 py-1 text-sm">{STATUS[m.status]}</span></td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/author/${m.id}`} aria-label={`${m.status === 'draft' ? 'Edit' : 'View'} ${m.title}, version ${m.version}`}>{m.status === 'draft' ? 'Edit' : 'View'}</Link>
                    </Button>
                    {m.status === 'published' && (
                      <Button size="sm" disabled={copy.isPending} aria-label={`New version of ${m.title}`} onClick={() => copy.mutate(m.id)}>New version</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
