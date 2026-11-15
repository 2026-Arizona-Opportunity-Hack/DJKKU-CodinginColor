import { useId } from 'react'
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseYouTubeId } from '@shared/authoring/schemas'
import { ConceptSelect } from './ConceptSelect'
import { KIND_LABEL, type ActivityFV, type ModuleFV } from './formTypes'
import { MarkdownField } from './MarkdownField'

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

/** One activity: title, required, concept, and the fields for its kind. Questions arrive in the next step. */
export function ActivityEditor({ lesson, index, count, kind, control, register, errors, readOnly, onMove, onRemove }: Props) {
  const id = useId()
  const at = `lessons.${lesson}.activities.${index}` as const
  const e = errors.lessons?.[lesson]?.activities?.[index]
  const url = useWatch({ control, name: `${at}.youtubeUrl` }) ?? ''
  const body = useWatch({ control, name: `${at}.body` }) ?? ''
  const questions = useWatch({ control, name: `${at}.questions` }) ?? []
  const videoId = kind === 'video' ? parseYouTubeId(url) : null
  const questionsError = (e as { questions?: { message?: string; root?: { message?: string } } } | undefined)?.questions

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

      {(kind === 'check' || kind === 'worksheet' || kind === 'exit') && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Questions: add them in the next step.</p>
          {questions.length > 0 && <p>{questions.length} question{questions.length === 1 ? '' : 's'} from your saved draft will be kept.</p>}
          <Err message={questionsError?.message ?? questionsError?.root?.message ? 'This needs at least one question, and the question editor arrives in the next update.' : undefined} />
        </div>
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
    </li>
  )
}
