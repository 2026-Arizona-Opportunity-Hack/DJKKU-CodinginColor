import { useId, useState } from 'react'
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseYouTubeId } from '@shared/authoring/schemas'
import { ActivityPreview } from './ActivityPreview'
import { ConceptSelect } from './ConceptSelect'
import { KIND_LABEL, type ActivityFV, type ModuleFV } from './formTypes'
import { MarkdownField } from './MarkdownField'
import { QuestionList } from './QuestionList'

type Props = {
  lesson: number
  index: number
  count: number
  kind: ActivityFV['kind']
  control: Control<ModuleFV>
  register: UseFormRegister<ModuleFV>
  errors: FieldErrors<ModuleFV>
  readOnly: boolean
  onMove: (to: number) => void
  onRemove: () => void
}

const Err = ({ message }: { message?: string }) => <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{message}</p>

/** One activity: title, required, concept, the fields for its kind, and a student preview. */
export function ActivityEditor({ lesson, index, count, kind, control, register, errors, readOnly, onMove, onRemove }: Props) {
  const id = useId()
  const at = `lessons.${lesson}.activities.${index}` as const
  const e = errors.lessons?.[lesson]?.activities?.[index]
  const url = useWatch({ control, name: `${at}.youtubeUrl` }) ?? ''
  const body = useWatch({ control, name: `${at}.body` }) ?? ''
  const prompt = useWatch({ control, name: `${at}.prompt` }) ?? ''
  const activity = useWatch({ control, name: at })
  const conceptId = useWatch({ control, name: `${at}.conceptId` })
  const [preview, setPreview] = useState(false)
  const videoId = kind === 'video' ? parseYouTubeId(url) : null
  const questionsError = (e as { questions?: unknown } | undefined)?.questions

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{KIND_LABEL[kind]}</h4>
        {!readOnly && (
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="outline" aria-label={`Move activity ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" aria-label={`Move activity ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" aria-label={`Delete activity ${index + 1}`} onClick={onRemove}><Trash2 aria-hidden="true" /></Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input id={`${id}-title`} disabled={readOnly} aria-invalid={Boolean(e?.title)} {...register(`${at}.title`)} />
        <Err message={e?.title?.message} />
      </div>

      {kind === 'video' && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-url`}>YouTube link</Label>
            <Input id={`${id}-url`} type="url" inputMode="url" disabled={readOnly} aria-invalid={Boolean(e?.youtubeUrl)} aria-describedby={`${id}-found`} {...register(`${at}.youtubeUrl`)} />
            <p id={`${id}-found`} className="text-sm" aria-live="polite">
              {videoId ? `Video found (${videoId}). Students see it without tracking cookies.` : url ? 'That is not a YouTube link we can use yet.' : 'Paste a youtube.com or youtu.be link.'}
            </p>
            <Err message={e?.youtubeUrl?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-transcript`}>Transcript (optional, for schools that block YouTube)</Label>
            <Textarea id={`${id}-transcript`} rows={4} disabled={readOnly} {...register(`${at}.transcript`)} />
            <Err message={e?.transcript?.message} />
          </div>
        </>
      )}

      {kind === 'reading' && (
        <MarkdownField label="Reading (markdown)" registration={register(`${at}.body`)} value={body} error={e?.body?.message} disabled={readOnly} />
      )}

      {kind === 'code' && (
        <>
          <MarkdownField label="Task for the student (markdown)" registration={register(`${at}.prompt`)} value={prompt} error={e?.prompt?.message} disabled={readOnly} />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-predict`}>Predict question (optional, asked before the first run)</Label>
            <Input id={`${id}-predict`} disabled={readOnly} placeholder="What will this program print?" {...register(`${at}.predict`)} />
            <Err message={e?.predict?.message} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-starter`}>Starter code (Python)</Label>
            <Textarea id={`${id}-starter`} rows={6} spellCheck={false} className="font-mono text-sm" disabled={readOnly} {...register(`${at}.starter`)} />
            <Err message={e?.starter?.message} />
          </div>
          <Controller
            control={control}
            name={`${at}.tests`}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-tests`}>Checks, one per line (up to 10)</Label>
                <Textarea
                  id={`${id}-tests`}
                  rows={3}
                  spellCheck={false}
                  className="font-mono text-sm"
                  disabled={readOnly}
                  aria-describedby={`${id}-tests-help`}
                  defaultValue={(field.value ?? []).join(String.fromCharCode(10))}
                  onChange={(ev) => field.onChange(ev.target.value.split(String.fromCharCode(10)).map((t) => t.trim()).filter(Boolean))}
                  onBlur={field.onBlur}
                />
                <p id={`${id}-tests-help`} className="text-sm text-muted-foreground">
                  Each line is a Python assert the student can see, for example <code>assert total == 55, "total should be 55"</code>. The text after the comma is shown when it fails.
                </p>
                <Err message={(e as { tests?: { message?: string } } | undefined)?.tests?.message} />
              </div>
            )}
          />
        </>
      )}

      {(kind === 'check' || kind === 'worksheet' || kind === 'exit') && (
        <QuestionList control={control} name={`${at}.questions`} max={kind === 'worksheet' ? 30 : 3} defaultConcept={conceptId ?? ''} readOnly={readOnly} errors={questionsError} />
      )}

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" role="switch" className="size-5" disabled={readOnly} {...register(`${at}.required`)} />
          Required
        </label>
        <Controller
          control={control}
          name={`${at}.conceptId`}
          render={({ field }) => <ConceptSelect value={field.value} onChange={field.onChange} disabled={readOnly} />}
        />
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <Button type="button" variant="outline" className="self-start" aria-expanded={preview} aria-controls={`${id}-preview`} onClick={() => setPreview((p) => !p)}>
          {preview ? 'Hide preview' : 'Preview as student'}
        </Button>
        {preview && (
          <section id={`${id}-preview`} aria-label={`Student preview of ${activity?.title || KIND_LABEL[kind]}`} className="rounded-md bg-muted/40 p-3">
            <ActivityPreview activity={activity} />
          </section>
        )}
      </div>
    </li>
  )
}
