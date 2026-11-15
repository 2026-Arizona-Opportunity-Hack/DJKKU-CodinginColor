import { useId, useState } from 'react'
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ActivityEditor } from './ActivityEditor'
import { KIND_LABEL, KINDS, newActivity, type ModuleFV } from './formTypes'

type Props = {
  index: number
  count: number
  control: Control<ModuleFV>
  register: UseFormRegister<ModuleFV>
  errors: FieldErrors<ModuleFV>
  readOnly: boolean
  onMove: (to: number) => void
  onRemove: () => void
}

/** One lesson: its title and an ordered list of activities (position is array order). */
export function LessonEditor({ index, count, control, register, errors, readOnly, onMove, onRemove }: Props) {
  const id = useId()
  const { fields, append, remove, move } = useFieldArray({ control, name: `lessons.${index}.activities` })
  const [kind, setKind] = useState<(typeof KINDS)[number]>('video')
  const e = errors.lessons?.[index]
  const listError = (e?.activities as { message?: string; root?: { message?: string } } | undefined)

  return (
    <li className="flex flex-col gap-4 rounded-xl border-2 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <Label htmlFor={`${id}-title`}>Lesson {index + 1} title</Label>
          <Input id={`${id}-title`} disabled={readOnly} aria-invalid={Boolean(e?.title)} {...register(`lessons.${index}.title`)} />
          <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{e?.title?.message}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="outline" aria-label={`Move lesson ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" aria-label={`Move lesson ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" aria-label={`Delete lesson ${index + 1}`} onClick={onRemove}><Trash2 aria-hidden="true" /></Button>
          </div>
        )}
      </div>

      {fields.length === 0 && <p className="text-sm text-muted-foreground">No activities yet. Add one below.</p>}
      <ol className="flex flex-col gap-3">
        {fields.map((field, j) => (
          <ActivityEditor
            key={field.id}
            lesson={index}
            index={j}
            count={fields.length}
            kind={field.kind}
            control={control}
            register={register}
            errors={errors}
            readOnly={readOnly}
            onMove={(to) => move(j, to)}
            onRemove={() => remove(j)}
          />
        ))}
      </ol>
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{listError?.message ?? listError?.root?.message ? 'Add at least one activity to this lesson.' : undefined}</p>

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-kind`}>Activity type</Label>
            <select id={`${id}-kind`} value={kind} onChange={(ev) => setKind(ev.target.value as typeof kind)} className="min-h-11 rounded-md border bg-background px-3 py-2">
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => append(newActivity(kind))}>Add activity</Button>
        </div>
      )}
    </li>
  )
}
