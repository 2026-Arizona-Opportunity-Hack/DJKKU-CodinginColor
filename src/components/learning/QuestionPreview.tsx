import { useId } from 'react'
import { BLANK, type QuestionContent } from '@shared/authoring/schemas'
import { InlineCode } from './InlineCode'

/**
 * A question as a student sees it, for previews. It takes student-safe content only (never a key),
 * holds no state and fetches nothing. Inputs are shown but switched off.
 */
export function QuestionPreview({ question, index }: { question: QuestionContent; index: number }) {
  const id = useId()
  const legend = (
    <legend className="mb-2 font-medium">
      <span className="sr-only">Question {index + 1}: </span>
      {question.type === 'fill_blank' ? 'Fill in the blanks' : <InlineCode text={question.prompt} />}
    </legend>
  )
  return (
    <fieldset disabled className="rounded-md border p-3">
      {legend}
      {question.type === 'mcq' && (
        <ul className="flex flex-col gap-1">
          {question.choices.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input type="radio" id={`${id}-${c.id}`} name={id} />
              <label htmlFor={`${id}-${c.id}`}><InlineCode text={c.text} /></label>
            </li>
          ))}
        </ul>
      )}
      {question.type === 'short_answer' && <input aria-label="Your answer" className="w-full rounded-md border px-3 py-2" />}
      {question.type === 'reflection' && <textarea aria-label="Your answer" rows={3} className="w-full rounded-md border px-3 py-2" />}
      {question.type === 'fill_blank' && (
        <p className="leading-loose">
          {question.prompt.split(BLANK).map((part, i, all) => (
            <span key={i}>
              <InlineCode text={part} />
              {i < all.length - 1 && <input aria-label={`Blank ${i + 1}`} className="mx-1 w-28 rounded-md border px-2" />}
            </span>
          ))}
        </p>
      )}
      {question.type === 'ordering' && question.display === 'code' && (
        <>
          <p className="mb-1 text-sm">Put the lines of code in order:</p>
          <ol className="flex flex-col gap-1">
            {question.items.map((item) => <li key={item.id} className="rounded-md border px-2 py-1 font-mono text-sm whitespace-pre-wrap">{item.text}</li>)}
          </ol>
        </>
      )}
      {question.type === 'ordering' && question.display !== 'code' && (
        <>
          <p className="mb-1 text-sm">Put these in order:</p>
          <ol className="list-decimal pl-6">
            {question.items.map((item) => <li key={item.id}><InlineCode text={item.text} /></li>)}
          </ol>
        </>
      )}
    </fieldset>
  )
}
