import { use, useId, useState } from 'react'
import { Controller, useFieldArray, type Control } from 'react-hook-form'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { AuthoredQuestion } from '@shared/authoring/schemas'
import type { ModuleFV } from './formTypes'
import { errorMessages, newQuestion, QUESTION_LABEL, QUESTION_TYPES, type QuestionType } from './questionDefaults'
import { IssuesContext } from './issues'
import { QuestionEditor } from './QuestionEditor'

type Props = {
  control: Control<ModuleFV>
  /** Form path of the questions array, for example lessons.0.activities.2.questions */
  name: string
  max: number
  defaultConcept: string
  readOnly: boolean
  errors: unknown
}

/** The questions of a check, worksheet or exit ticket: add (with a type), edit, reorder, delete. */
export function QuestionList({ control, name, max, defaultConcept, readOnly, errors }: Props) {
  const id = useId()
  const path = name as 'lessons.0.activities.0.questions'
  const { fields, append, remove, move } = useFieldArray({ control, name: path })
  const [type, setType] = useState<QuestionType>('mcq')
  const list = errors as Record<string, unknown> | undefined
  const issues = use(IssuesContext)
  const listLevel = list && (typeof list.message === 'string' || list.root) ? 'Add at least one question.' : ''

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {fields.map((field, k) => {
          const qid = (field as unknown as AuthoredQuestion).content?.id
          const messages = [
            ...errorMessages(list?.[k]),
            ...issues.filter((m) => qid && m.includes(`question "${qid}"`)).map((m) => m.replace(/^.*question "[^"]*": /, '')),
          ]
          return (
            <li key={field.id} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="font-semibold">Question {k + 1}</h5>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="outline" aria-label={`Move question ${k + 1} up`} disabled={k === 0} onClick={() => move(k, k - 1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="outline" aria-label={`Move question ${k + 1} down`} disabled={k === fields.length - 1} onClick={() => move(k, k + 1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="outline" aria-label={`Delete question ${k + 1}`} onClick={() => remove(k)}><Trash2 aria-hidden="true" /></Button>
                  </div>
                )}
              </div>
              <Controller
                control={control}
                name={`${path}.${k}` as `lessons.0.activities.0.questions.${number}`}
                render={({ field: f }) => <QuestionEditor value={f.value as AuthoredQuestion} onChange={f.onChange} disabled={readOnly} />}
              />
              {messages.length > 0 && (
                <ul role="alert" className="list-disc pl-5 text-sm font-medium text-destructive">
                  {messages.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      {fields.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{fields.length === 0 ? listLevel : ''}</p>
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-type`}>Question type</Label>
            <select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as QuestionType)} className="min-h-11 rounded-md border bg-background px-3 py-2">
              {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_LABEL[t]}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" disabled={fields.length >= max} onClick={() => append(newQuestion(type, defaultConcept))}>
            Add question
          </Button>
          {fields.length >= max && <p className="text-sm">At most {max} questions here.</p>}
        </div>
      )}
    </div>
  )
}
