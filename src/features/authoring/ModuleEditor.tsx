import { useEffect, useId, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { authoredAssessment, authoredModule, toDraftPayload, type AuthoredAssessment, type AuthoredModule } from '@shared/authoring/schemas'
import { loadModule, newVersion, saveDraft } from './api'
import type { ModuleFV } from './formTypes'
import { LessonEditor } from './LessonEditor'
import { modulesKey } from './keys'
import { SubmitForReview } from './SubmitForReview'
import { TestBuilder } from './TestBuilder'

const EMPTY: ModuleFV = { title: '', summary: '', lessons: [{ title: '', activities: [] }], pre: null, post: null }

// The module contract plus its two tests, validated together on save.
const editorSchema = authoredModule.extend({ pre: authoredAssessment.nullable().optional(), post: authoredAssessment.nullable().optional() })
type EditorOutput = AuthoredModule & { pre?: AuthoredAssessment | null; post?: AuthoredAssessment | null }

/** `/author/new` and `/author/:moduleId`. A saved module is loaded fresh each time it is opened. */
export function ModuleEditor() {
  const { moduleId } = useParams()
  const loaded = useQuery({
    queryKey: ['authoring', 'module', moduleId],
    queryFn: () => loadModule(moduleId!),
    enabled: Boolean(moduleId),
    gcTime: 0, // never reuse an old copy: the form starts from whatever was loaded
  })
  if (!moduleId) return <EditorForm moduleId={null} initial={EMPTY} status="draft" version={1} />
  if (loaded.isPending) return <p role="status">Loading the module…</p>
  if (loaded.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-destructive">
        <p>{loaded.error.message}</p>
        <Button variant="outline" onClick={() => void loaded.refetch()}>Try again</Button>
      </div>
    )
  }
  const m = loaded.data
  const initial = { ...m.module, pre: m.pre, post: m.post } as ModuleFV
  return <EditorForm moduleId={m.id} slug={m.slug} initial={initial} status={m.module.status} version={m.version} keysHidden={m.keysHidden} />
}

function EditorForm({
  moduleId, slug, initial, status, version, keysHidden = false,
}: {
  moduleId: string | null
  slug?: string
  initial: ModuleFV
  status: 'draft' | 'submitted' | 'published'
  version: number
  keysHidden?: boolean
}) {
  const id = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const readOnly = status !== 'draft'
  const skipBlock = useRef(false)
  const [savedAt, setSavedAt] = useState<Date | null>(() => {
    const t = (location.state as { savedAt?: number } | null)?.savedAt
    return t ? new Date(t) : null
  })
  const form = useForm<ModuleFV>({ resolver: zodResolver(editorSchema) as unknown as Resolver<ModuleFV>, defaultValues: initial })
  const { control, register, handleSubmit, reset, setValue, getValues, formState: { errors, isDirty, submitCount } } = form
  const toPayload = ({ pre, post, ...module }: EditorOutput) => toDraftPayload({ moduleId, slug, module, pre: pre ?? null, post: post ?? null })
  const lessons = useFieldArray({ control, name: 'lessons' })

  const save = useMutation({
    mutationFn: (values: EditorOutput) => saveDraft(toPayload(values)),
    onSuccess: async (savedId, values) => {
      skipBlock.current = true
      reset(values as ModuleFV)
      setSavedAt(new Date())
      await queryClient.invalidateQueries({ queryKey: modulesKey })
      if (!moduleId) navigate(`/author/${savedId}`, { replace: true, state: { savedAt: Date.now() } })
      else skipBlock.current = false
    },
  })
  const version2 = useMutation({
    mutationFn: () => newVersion(moduleId!),
    onSuccess: async (newId) => {
      await queryClient.invalidateQueries({ queryKey: modulesKey })
      navigate(`/author/${newId}`)
    },
  })

  // After submitting, the module reloads as "submitted" (locked); focus moves to that message so a
  // screen reader hears it, since the button that was focused is gone.
  const [reviewNotes, setReviewNotes] = useState<string[] | null>(null)
  const submittedBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (status === 'submitted' && reviewNotes) submittedBox.current?.focus()
  }, [status, reviewNotes])
  const onSubmitted = async (warnings: string[]) => {
    setReviewNotes(warnings)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: modulesKey }),
      queryClient.invalidateQueries({ queryKey: ['authoring', 'module', moduleId] }),
    ])
  }

  // Leaving with unsaved changes: the browser asks on reload or close, the router asks on navigation.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !skipBlock.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const invalid = submitCount > 0 && Object.keys(errors).length > 0

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={handleSubmit((values) => save.mutate(values as unknown as EditorOutput))} aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-2xl font-semibold">{moduleId ? 'Edit module' : 'New module'}{version > 1 ? ` (version ${version})` : ''}</h2>
        <Link className="inline-flex min-h-11 items-center underline" to="/author">Back to my modules</Link>
      </div>

      {blocker.state === 'blocked' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-tint-yellow-edge bg-tint-yellow p-3 text-tint-yellow-fg">
          <p className="font-medium">You have unsaved changes. Leave without saving?</p>
          <Button type="button" variant="outline" onClick={() => blocker.proceed()}>Leave without saving</Button>
          <Button type="button" onClick={() => blocker.reset()}>Keep editing</Button>
        </div>
      )}
      {status === 'published' && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <p>This version is published and cannot be changed. Make a new version to edit it.</p>
          <Button type="button" disabled={version2.isPending} onClick={() => version2.mutate()}>{version2.isPending ? 'Copying…' : 'New version'}</Button>
        </div>
      )}
      {status === 'submitted' && (
        <div ref={submittedBox} tabIndex={-1} className="flex flex-col gap-2 rounded-md border p-3">
          <p>Submitted for review. It is locked until a CIC admin publishes it or sends it back.</p>
          {reviewNotes && reviewNotes.length > 0 && (
            <>
              <p className="font-medium">Notes for the reviewer:</p>
              <ul className="list-disc pl-6">{reviewNotes.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          )}
        </div>
      )}
      {keysHidden && <p className="rounded-md border p-3">You can read this module but not its answer keys.</p>}
      <p role="alert" className="text-destructive empty:hidden">{version2.error?.message}</p>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-title`}>Module title</Label>
        <Input id={`${id}-title`} disabled={readOnly} aria-invalid={Boolean(errors.title)} {...register('title')} />
        <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{errors.title?.message}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-summary`}>Summary (optional, up to 500 characters)</Label>
        <Textarea id={`${id}-summary`} rows={3} disabled={readOnly} aria-invalid={Boolean(errors.summary)} {...register('summary')} />
        <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{errors.summary?.message}</p>
      </div>

      <section aria-labelledby={`${id}-lessons`} className="flex flex-col gap-4">
        <h3 id={`${id}-lessons`} className="text-xl font-semibold">Lessons</h3>
        <ol className="flex flex-col gap-4">
          {lessons.fields.map((field, i) => (
            <LessonEditor
              key={field.id}
              index={i}
              count={lessons.fields.length}
              control={control}
              register={register}
              errors={errors}
              readOnly={readOnly}
              onMove={(to) => lessons.move(i, to)}
              onRemove={() => lessons.remove(i)}
            />
          ))}
        </ol>
        <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{(errors.lessons as { message?: string; root?: { message?: string } } | undefined)?.root?.message ?? (errors.lessons as { message?: string } | undefined)?.message ? 'A module needs at least one lesson.' : undefined}</p>
        {!readOnly && <Button type="button" variant="outline" className="self-start" onClick={() => lessons.append({ title: '', activities: [] })}>Add lesson</Button>}
      </section>

      {!keysHidden && <TestBuilder control={control} register={register} setValue={setValue} getValues={getValues} errors={errors} readOnly={readOnly} />}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4 border-t pt-4">
          <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save draft'}</Button>
          <p role="status" className="text-sm">{savedAt && !isDirty ? `Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : isDirty ? 'Unsaved changes' : ''}</p>
          <p role="alert" className="basis-full font-medium text-destructive empty:hidden">
            {save.error?.message ?? (invalid ? 'Some fields need attention. Fix them and save again.' : '')}
          </p>
          {moduleId && (
            <div className="basis-full">
              <SubmitForReview moduleId={moduleId} dirty={isDirty} onSubmitted={onSubmitted} />
            </div>
          )}
        </div>
      )}
    </form>
  )
}
