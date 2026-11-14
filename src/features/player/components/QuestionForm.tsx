import { useMemo, type ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import type { Question, QuestionResponse } from '@/features/player/content'

import { defaultValues, formSchema, toResponses, type FormValues } from '../questionForm'
import { QuestionField } from './QuestionField'

type Props = {
  questions: Question[]
  onSubmit: (responses: Record<string, QuestionResponse>) => void
  submitLabel: string
  pending: boolean
  /** Locks the inputs (e.g. after a one-time test is sent). */
  locked?: boolean
  children?: ReactNode
}

/**
 * One form for checks, exits, worksheets and tests. Answers stay in the form after a
 * failed submit (B13); the submit button disables while pending.
 */
export function QuestionForm({ questions, onSubmit, submitLabel, pending, locked, children }: Props) {
  const schema = useMemo(() => formSchema(questions), [questions])
  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: useMemo(() => defaultValues(questions), [questions]),
  })
  const errorCount = Object.keys(methods.formState.errors).length

  return (
    <FormProvider {...methods}>
      <form noValidate className="flex flex-col gap-6" onSubmit={methods.handleSubmit((values) => onSubmit(toResponses(questions, values)))}>
        {questions.map((q, i) => (
          <QuestionField key={q.id} question={q} index={i} disabled={locked} />
        ))}
        <p aria-live="polite" className="text-sm font-medium text-destructive empty:hidden">
          {errorCount > 0 ? `Check ${errorCount === 1 ? '1 answer' : `${errorCount} answers`} above before sending.` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending || locked}>
            {pending ? 'Sending…' : submitLabel}
          </Button>
          {children}
        </div>
      </form>
    </FormProvider>
  )
}
