import { useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMe } from '@/lib/session'
import { CreateClassSchema, type CreateClassInput } from '@shared/classes'
import { classesKey } from './hooks'
import { createClass } from './setupApi'

/** Creates a class and makes the caller its instructor. Only a CIC admin can add a new school. */
export function CreateClassForm() {
  const id = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useMe().data?.role === 'cic_admin'
  const { register, handleSubmit, formState: { errors } } = useForm<CreateClassInput>({ resolver: zodResolver(CreateClassSchema) })
  const create = useMutation({
    mutationFn: createClass,
    onSuccess: async ({ class_id }) => {
      await queryClient.invalidateQueries({ queryKey: classesKey })
      navigate(`/instructor/${class_id}`)
    },
  })

  const field = (name: keyof CreateClassInput, label: string, hint?: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`${id}-${name}`}>{label}</Label>
      <Input id={`${id}-${name}`} aria-invalid={Boolean(errors[name])} aria-describedby={`${id}-${name}-msg`} {...register(name)} />
      <p id={`${id}-${name}-msg`} className="text-sm text-muted-foreground">{hint}</p>
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{errors[name]?.message}</p>
    </div>
  )

  return (
    <section aria-labelledby={`${id}-title`} className="flex max-w-xl flex-col gap-3">
      <h2 id={`${id}-title`} className="text-xl font-semibold">Create a class</h2>
      <form noValidate className="flex flex-col gap-3" onSubmit={handleSubmit((v) => create.mutate(v))}>
        {field('schoolName', 'School name', isAdmin ? 'As a CIC admin you can type a new school.' : 'Use a school that is already set up.')}
        {field('name', 'Class name')}
        {field('term', 'Term (optional)', 'For example Fall 2026.')}
        <div role="alert" className="text-sm font-medium text-destructive empty:hidden">{create.error?.message}</div>
        <Button type="submit" disabled={create.isPending} className="self-start">
          {create.isPending ? 'Creating…' : 'Create class'}
        </Button>
      </form>
    </section>
  )
}
