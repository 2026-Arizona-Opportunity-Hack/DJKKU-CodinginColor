import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BLANK, type AuthoredQuestion, type QuestionKey } from '@shared/authoring/schemas'
import { ConceptSelect } from './ConceptSelect'
import { QUESTION_LABEL, shortId } from './questionDefaults'

type Q = AuthoredQuestion
type Props = { value: Q; onChange: (q: Q) => void; disabled?: boolean }
type Scored = Exclude<QuestionKey, never>

const moveItem = <T,>(list: T[], from: number, to: number) => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** Answers typed one per line. Keeps the raw text so a new empty line is not swallowed while typing. */
function LinesField({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const id = useId()
  const [text, setText] = useState(value.join('\n'))
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
        }}
      />
    </div>
  )
}

/** One editable row (a choice or an ordering item) with move and delete. */
function RowEditor({ label, text, onText, index, count, min, onMove, onRemove, disabled, children, mono }: {
  label: string; text: string; onText: (t: string) => void; index: number; count: number; min: number
  onMove: (to: number) => void; onRemove: () => void; disabled?: boolean; children?: React.ReactNode; mono?: boolean
}) {
  const id = useId()
  return (
    <li className="flex flex-wrap items-end gap-2">
      {children}
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={text} disabled={disabled} className={mono ? 'font-mono whitespace-pre' : undefined} spellCheck={mono ? false : undefined} onChange={(e) => onText(e.target.value)} />
      </div>
      {!disabled && (
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" aria-label={`Move ${label.toLowerCase()} up`} disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="outline" aria-label={`Move ${label.toLowerCase()} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}><ArrowDown aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="outline" aria-label={`Delete ${label.toLowerCase()}`} disabled={count <= min} onClick={onRemove}><Trash2 aria-hidden="true" /></Button>
        </div>
      )}
    </li>
  )
}

function McqFields({ value, onChange, disabled }: Props) {
  const id = useId()
  if (value.content.type !== 'mcq' || value.key?.type !== 'mcq') return null
  const content = value.content
  const key = value.key
  const setChoices = (choices: typeof content.choices) => onChange({ content: { ...content, choices }, key })
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">Choices (pick the correct one)</legend>
      <ul className="flex flex-col gap-2">
        {content.choices.map((c, i) => (
          <RowEditor
            key={c.id}
            label={`Choice ${i + 1}`}
            text={c.text}
            index={i}
            count={content.choices.length}
            min={2}
            disabled={disabled}
            onText={(text) => setChoices(content.choices.map((x) => (x.id === c.id ? { ...x, text } : x)))}
            onMove={(to) => setChoices(moveItem(content.choices, i, to))}
            onRemove={() => onChange({ content: { ...content, choices: content.choices.filter((x) => x.id !== c.id) }, key: { ...key, correctChoiceId: key.correctChoiceId === c.id ? '' : key.correctChoiceId } })}
          >
            <label className="flex min-h-11 items-center gap-1 text-sm">
              <input type="radio" name={`${id}-correct`} className="size-5" disabled={disabled} checked={key.correctChoiceId === c.id} onChange={() => onChange({ content, key: { ...key, correctChoiceId: c.id } })} />
              Correct
              <span className="sr-only">: choice {i + 1}</span>
            </label>
          </RowEditor>
        ))}
      </ul>
      {!disabled && content.choices.length < 8 && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setChoices([...content.choices, { id: shortId('c', 4), text: '' }])}>Add choice</Button>
      )}
    </fieldset>
  )
}

function ShortAnswerFields({ value, onChange, disabled }: Props) {
  if (value.key?.type !== 'short_answer') return null
  const key = value.key
  return (
    <div className="flex flex-col gap-2">
      <LinesField label="Accepted answers (one per line)" value={key.accepted} disabled={disabled} onChange={(accepted) => onChange({ ...value, key: { ...key, accepted } })} />
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="size-5" disabled={disabled} checked={key.caseSensitive} onChange={(e) => onChange({ ...value, key: { ...key, caseSensitive: e.target.checked } })} />
        Case sensitive
      </label>
    </div>
  )
}

const blankCount = (prompt: string) => prompt.split(BLANK).length - 1

function FillBlankFields({ value, onChange, disabled }: Props) {
  if (value.key?.type !== 'fill_blank') return null
  const key = value.key
  const n = blankCount(value.content.prompt)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Write {BLANK} (three underscores) in the question text for each blank. This text has {n} blank{n === 1 ? '' : 's'}.</p>
      {key.blanks.map((answers, i) => (
        <LinesField
          key={i}
          label={`Accepted answers for blank ${i + 1} (one per line)`}
          value={answers}
          disabled={disabled}
          onChange={(list) => onChange({ ...value, key: { ...key, blanks: key.blanks.map((b, j) => (j === i ? list : b)) } })}
        />
      ))}
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="size-5" disabled={disabled} checked={key.caseSensitive} onChange={(e) => onChange({ ...value, key: { ...key, caseSensitive: e.target.checked } })} />
        Case sensitive
      </label>
    </div>
  )
}

function OrderingFields({ value, onChange, disabled }: Props) {
  if (value.content.type !== 'ordering' || value.key?.type !== 'ordering') return null
  const content = value.content
  const key = value.key
  // The author lists the items in the correct order; students see them shuffled.
  const setItems = (items: typeof content.items) => onChange({ content: { ...content, items }, key: { ...key, correctOrder: items.map((i) => i.id) } })
  const code = content.display === 'code'
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">{code ? 'Lines of code, in the correct order' : 'Items, in the correct order'} (students see them shuffled)</legend>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          className="size-5"
          disabled={disabled}
          checked={code}
          onChange={(e) => onChange({ content: { ...content, display: e.target.checked ? 'code' : undefined }, key })}
        />
        These are lines of code (a Parsons problem). Type each line with its indentation.
      </label>
      <ol className="flex flex-col gap-2">
        {content.items.map((item, i) => (
          <RowEditor
            key={item.id}
            label={code ? `Line ${i + 1}` : `Item ${i + 1}`}
            mono={code}
            text={item.text}
            index={i}
            count={content.items.length}
            min={2}
            disabled={disabled}
            onText={(text) => setItems(content.items.map((x) => (x.id === item.id ? { ...x, text } : x)))}
            onMove={(to) => setItems(moveItem(content.items, i, to))}
            onRemove={() => setItems(content.items.filter((x) => x.id !== item.id))}
          />
        ))}
      </ol>
      {!disabled && content.items.length < 10 && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setItems([...content.items, { id: shortId('i', 4), text: '' }])}>{code ? 'Add line' : 'Add item'}</Button>
      )}
    </fieldset>
  )
}

/** Explanation and the hint ladder. Both live in the KEY, never in what students receive. */
function KeyExtras({ value, onChange, disabled }: Props) {
  const id = useId()
  if (!value.key) return null
  const key = value.key as Scored
  const set = (patch: Partial<Scored>) => onChange({ ...value, key: { ...key, ...patch } as QuestionKey })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-exp`}>Explanation (shown once the activity is done)</Label>
        <Textarea id={`${id}-exp`} rows={2} disabled={disabled} value={key.explanation ?? ''} onChange={(e) => set({ explanation: e.target.value || undefined })} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Hints</legend>
        <p className="text-sm text-muted-foreground">Shown after each wrong try, one at a time. Up to 3.</p>
        {key.hints.map((hint, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={`${id}-hint-${i}`}>Hint {i + 1}</Label>
              <Input id={`${id}-hint-${i}`} disabled={disabled} value={hint} onChange={(e) => set({ hints: key.hints.map((h, j) => (j === i ? e.target.value : h)) })} />
            </div>
            {!disabled && (
              <Button type="button" size="icon" variant="outline" aria-label={`Delete hint ${i + 1}`} onClick={() => set({ hints: key.hints.filter((_, j) => j !== i) })}><Trash2 aria-hidden="true" /></Button>
            )}
          </div>
        ))}
        {!disabled && key.hints.length < 3 && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ hints: [...key.hints, ''] })}>Add hint</Button>
        )}
      </fieldset>
    </div>
  )
}

/** One question of any type, edited in place. The id is never changed here. */
export function QuestionEditor({ value, onChange, disabled }: Props) {
  const id = useId()
  const { content } = value
  const scored = content.type !== 'reflection'
  const setPrompt = (prompt: string) => {
    if (content.type === 'fill_blank' && value.key?.type === 'fill_blank') {
      const n = blankCount(prompt)
      const blanks = Array.from({ length: n }, (_, i) => value.key!.type === 'fill_blank' ? ((value.key as { blanks: string[][] }).blanks[i] ?? []) : [])
      return onChange({ content: { ...content, prompt }, key: { ...value.key, blanks } })
    }
    onChange({ ...value, content: { ...content, prompt } } as Q)
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        {QUESTION_LABEL[content.type]}
        {!scored && <span className="ml-2 rounded-full border px-2 py-0.5">Not scored</span>}
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-prompt`}>Question text</Label>
        <Textarea id={`${id}-prompt`} rows={2} disabled={disabled} value={content.prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <McqFields value={value} onChange={onChange} disabled={disabled} />
      <ShortAnswerFields value={value} onChange={onChange} disabled={disabled} />
      <FillBlankFields value={value} onChange={onChange} disabled={disabled} />
      <OrderingFields value={value} onChange={onChange} disabled={disabled} />
      {scored && (
        <>
          <ConceptSelect
            label="Concept for this question"
            value={'conceptId' in content ? content.conceptId : null}
            disabled={disabled}
            onChange={(conceptId) => onChange({ ...value, content: { ...content, conceptId: conceptId ?? '' } } as Q)}
          />
          <KeyExtras value={value} onChange={onChange} disabled={disabled} />
        </>
      )}
    </div>
  )
}
