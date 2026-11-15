import { useId, useState } from 'react'
import { Controller, useFormContext, type FieldError } from 'react-hook-form'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { blankCount, labelBlanks, type Question } from '../content'

import { fieldName, move, type FormValues } from '../questionForm'
import { InlineCode } from '@/components/learning/InlineCode'

type Props = { question: Question; index: number; disabled?: boolean }

function FieldErrorText({ id, error }: { id: string; error?: FieldError | string }) {
  const message = typeof error === 'string' ? error : error?.message
  if (!message) return null
  return (
    <p id={id} className="text-sm font-medium text-destructive">
      <span aria-hidden="true">! </span>
      {message}
    </p>
  )
}

const legendClass = 'mb-2 text-base font-medium'

/** One question, any type (B8). Errors sit next to the field and are tied to it with aria-describedby. */
export function QuestionField({ question, index, disabled }: Props) {
  const name = fieldName(index)
  const id = useId()
  const errorId = `${id}-error`
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>()
  const fieldError = errors[name]
  const errorMessage = fieldError?.message ?? (Array.isArray(fieldError) ? fieldError.find(Boolean)?.message : undefined)
  const invalid = Boolean(fieldError)
  const describedBy = invalid ? errorId : undefined

  switch (question.type) {
    case 'mcq':
      return (
        <fieldset aria-describedby={describedBy} disabled={disabled}>
          <legend className={legendClass}>
            <InlineCode text={question.prompt} />
          </legend>
          <div className="flex flex-col gap-2">
            {question.choices.map((choice) => (
              <label
                key={choice.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2 transition-colors hover:border-tint-green-edge has-[:checked]:border-primary has-[:checked]:bg-tint-green has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input type="radio" value={choice.id} className="size-5 accent-primary" {...register(name)} />
                <span>
                  <InlineCode text={choice.text} />
                </span>
              </label>
            ))}
          </div>
          <FieldErrorText id={errorId} error={errorMessage} />
        </fieldset>
      )

    case 'short_answer':
    case 'reflection': {
      const long = question.type === 'reflection'
      const Field = long ? Textarea : Input
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-base leading-snug">
            <span>
              <InlineCode text={question.prompt} />
              {long && <span className="ml-1 font-normal text-muted-foreground">(not graded)</span>}
            </span>
          </Label>
          <Field id={id} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} {...register(name)} />
          <FieldErrorText id={errorId} error={errorMessage} />
        </div>
      )
    }

    case 'fill_blank':
      return (
        <fieldset aria-describedby={describedBy} disabled={disabled}>
          <legend className={legendClass}>
            <InlineCode text={labelBlanks(question.prompt)} />
          </legend>
          <div className="flex flex-col gap-3 sm:flex-row">
            {Array.from({ length: blankCount(question) }, (_, b) => (
              <div key={b} className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`${id}-${b}`}>
                  Blank {b + 1} of {blankCount(question)}
                </Label>
                <Input
                  id={`${id}-${b}`}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  {...register(`${name}.${b}`)}
                />
              </div>
            ))}
          </div>
          <FieldErrorText id={errorId} error={errorMessage} />
        </fieldset>
      )

    case 'ordering':
      return (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <OrderingList question={question} order={field.value as string[]} onChange={field.onChange} disabled={disabled} />
          )}
        />
      )
  }
}

/** Keyboard-first ordering (ADR 0005): every item has Move up / Move down buttons. */
function OrderingList({
  question,
  order,
  onChange,
  disabled,
}: {
  question: Extract<Question, { type: 'ordering' }>
  order: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [announcement, setAnnouncement] = useState('')
  const textOf = (itemId: string) => question.items.find((i) => i.id === itemId)?.text ?? itemId
  // A Parsons problem: the items are lines of code, indentation included.
  const code = question.display === 'code'

  function moveItem(from: number, to: number) {
    const itemId = order[from]
    // Edge buttons stay focusable (aria-disabled) so focus isn't lost when an item reaches the end.
    if (itemId === undefined || to < 0 || to >= order.length) return
    onChange(move(order, from, to))
    setAnnouncement(`Moved "${textOf(itemId)}" to position ${to + 1} of ${order.length}.`)
  }

  return (
    <fieldset disabled={disabled}>
      <legend className={legendClass}>
        <InlineCode text={question.prompt} />
      </legend>
      {code && <p className="mb-2 text-sm text-muted-foreground">Put the lines of code in order. The indentation is already right.</p>}
      <ol className="flex flex-col gap-2">
        {order.map((itemId, i) => (
          <li key={itemId} className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-1">
            <span aria-hidden="true" className="w-6 text-sm text-muted-foreground">
              {i + 1}.
            </span>
            <span className={`flex-1 font-mono text-sm ${code ? 'whitespace-pre-wrap' : 'break-words'}`}>{textOf(itemId)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move "${textOf(itemId)}" up`}
              aria-disabled={i === 0}
              onClick={() => moveItem(i, i - 1)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move "${textOf(itemId)}" down`}
              aria-disabled={i === order.length - 1}
              onClick={() => moveItem(i, i + 1)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      {code && (
        <figure className="mt-3">
          <figcaption className="mb-1 text-sm font-medium">Your program so far</figcaption>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm">{order.map(textOf).join(String.fromCharCode(10))}</pre>
        </figure>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  )
}
