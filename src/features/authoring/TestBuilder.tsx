import { useId, useState } from 'react'
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormGetValues, type UseFormRegister, type UseFormSetValue } from 'react-hook-form'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pairWarnings, type AuthoredAssessment, type AuthoredQuestion } from '@shared/authoring/schemas'
import { AiDraft } from './AiDraft'
import type { ItemFV, ModuleFV, TestFV } from './formTypes'
import { errorMessages, newQuestion, QUESTION_LABEL, QUESTION_TYPES, shortId, type QuestionType } from './questionDefaults'
import { QuestionEditor } from './QuestionEditor'

type Kind = 'pre' | 'post'
const NAME: Record<Kind, string> = { pre: 'Pre-test', post: 'Post-test' }
const TEST_TYPES = QUESTION_TYPES.filter((t) => t !== 'reflection') // a test item must be scored

export type TestBuilderProps = {
  control: Control<ModuleFV>
  register: UseFormRegister<ModuleFV>
  setValue: UseFormSetValue<ModuleFV>
  getValues: UseFormGetValues<ModuleFV>
  errors: FieldErrors<ModuleFV>
  readOnly: boolean
}

const nextPairKey = (items: ItemFV[]) => {
  const used = new Set(items.map((i) => i.pairKey))
  let n = items.length + 1
  while (used.has(`p${n}`)) n++
  return `p${n}`
}

function TestItems({ kind, control, register, setValue, errors, readOnly }: TestBuilderProps & { kind: Kind }) {
  const id = useId()
  const { fields, append, remove, move } = useFieldArray({ control, name: `${kind}.items` })
  const items = (useWatch({ control, name: `${kind}.items` }) ?? []) as ItemFV[]
  const [type, setType] = useState<QuestionType>('mcq')
  const e = errors[kind] as { items?: Record<string, unknown> & { root?: { message?: string }; message?: string } } | undefined
  const listMessage = e?.items?.root?.message ?? (typeof e?.items?.message === 'string' ? e.items.message : undefined)

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {fields.map((field, k) => {
          const messages = errorMessages(e?.items?.[k])
          return (
            <li key={field.id} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">{NAME[kind]} item {k + 1}</h4>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="outline" aria-label={`Move ${NAME[kind]} item ${k + 1} up`} disabled={k === 0} onClick={() => move(k, k - 1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="outline" aria-label={`Move ${NAME[kind]} item ${k + 1} down`} disabled={k === fields.length - 1} onClick={() => move(k, k + 1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button type="button" size="icon" variant="outline" aria-label={`Delete ${NAME[kind]} item ${k + 1}`} onClick={() => remove(k)}><Trash2 aria-hidden="true" /></Button>
                  </div>
                )}
              </div>
              <div className="flex max-w-xs flex-col gap-1">
                <Label htmlFor={`${id}-${field.id}-pair`}>Pair key</Label>
                <Input id={`${id}-${field.id}-pair`} disabled={readOnly} {...register(`${kind}.items.${k}.pairKey`)} />
              </div>
              <Controller
                control={control}
                name={`${kind}.items.${k}.question`}
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
      {fields.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">
        {listMessage ? (fields.length === 0 ? 'Add at least one item, or remove this test.' : listMessage) : ''}
      </p>
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-type`}>Item type</Label>
            <select id={`${id}-type`} value={type} onChange={(ev) => setType(ev.target.value as QuestionType)} className="min-h-11 rounded-md border bg-background px-3 py-2">
              {TEST_TYPES.map((t) => <option key={t} value={t}>{QUESTION_LABEL[t]}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" disabled={fields.length >= 50} onClick={() => append({ pairKey: nextPairKey(items), question: newQuestion(type, '') })}>Add item</Button>
          <Button type="button" variant="outline" onClick={() => setValue(kind, null, { shouldDirty: true })}>Remove {NAME[kind].toLowerCase()}</Button>
        </div>
      )}
    </div>
  )
}

/** Pre-test and post-test, one tab each. Items with the same pair key are compared for learning gain. */
export function TestBuilder(props: TestBuilderProps) {
  const id = useId()
  const { control, setValue, getValues, readOnly } = props
  const [tab, setTab] = useState<Kind>('pre')
  const pre = useWatch({ control, name: 'pre' }) as TestFV | null | undefined
  const post = useWatch({ control, name: 'post' }) as TestFV | null | undefined
  const tests = { pre, post }
  const warnings =
    pre && post
      ? pairWarnings(pre as AuthoredAssessment, post as AuthoredAssessment)
      : pre || post
        ? [`There is no ${pre ? 'post-test' : 'pre-test'} yet, so this module will show no learning gain.`]
        : ['This module has no pre-test or post-test yet, so it will show no learning gain. Draft them with AI or add them by hand.']

  function copyPreToPost() {
    if (!pre) return
    if (post?.items.length && !window.confirm('Replace the post-test with a copy of the pre-test?')) return
    const items = pre.items.map((item) => {
      const copy = structuredClone(item)
      copy.question.content.id = shortId('q') // its own question id; the pair key links it to the pre item
      return copy
    })
    setValue('post', { kind: 'post', items }, { shouldDirty: true })
    setTab('post')
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h3 id={`${id}-title`} className="text-xl font-semibold">Pre-test and post-test</h3>
      <p className="text-sm text-muted-foreground">
        Students take the pre-test before the module and the post-test after it. Items with the same pair key are compared to
        measure learning gain, so they should test the same skill in different words.
      </p>
      {!readOnly && <AiDraft setValue={setValue} getValues={getValues} onDrafted={() => setTab('pre')} />}
      <div role="tablist" aria-label="Tests" className="flex gap-1">
        {(['pre', 'post'] as const).map((k) => (
          <Button key={k} type="button" role="tab" id={`${id}-tab-${k}`} aria-selected={tab === k} aria-controls={`${id}-panel-${k}`} variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>
            {NAME[k]}{tests[k] ? ` (${tests[k]!.items.length})` : ''}
          </Button>
        ))}
      </div>
      {warnings.length > 0 && (
        <ul aria-label="Pairing warnings" className="list-disc rounded-md border border-tint-yellow-edge bg-tint-yellow py-2 pr-3 pl-8 text-sm text-tint-yellow-fg">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {(['pre', 'post'] as const).map((k) => (
        <div key={k} role="tabpanel" id={`${id}-panel-${k}`} aria-labelledby={`${id}-tab-${k}`} hidden={tab !== k} className="flex flex-col gap-3">
          {tests[k] ? (
            <TestItems kind={k} {...props} />
          ) : readOnly ? (
            <p>This module has no {NAME[k].toLowerCase()}.</p>
          ) : (
            <Button type="button" variant="outline" className="self-start" onClick={() => setValue(k, { kind: k, items: [] }, { shouldDirty: true })}>Add a {NAME[k].toLowerCase()} by hand</Button>
          )}
          {k === 'post' && !readOnly && pre && pre.items.length > 0 && (
            <Button type="button" variant="outline" className="self-start" onClick={copyPreToPost}>Copy pre-test into post-test</Button>
          )}
        </div>
      ))}
    </section>
  )
}
