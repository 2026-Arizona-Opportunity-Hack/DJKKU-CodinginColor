import { useId, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MAX_PAIRS, MIN_PAIRS } from '@shared/authoring/draftTests'
import { listConcepts } from './api'
import { draftTests, toDraftRequest } from './draftTestsApi'
import type { TestFV } from './formTypes'
import { conceptsKey } from './keys'
import type { TestBuilderProps } from './TestBuilder'

/**
 * "Draft both tests with AI": reads the module on screen (readings, video transcripts, code tasks,
 * question prompts) and fills both tests with paired items. A draft only: nothing is saved until the
 * author saves, and the usual submit and publish review still applies.
 */
export function AiDraft({ setValue, getValues, onDrafted }: Pick<TestBuilderProps, 'setValue' | 'getValues'> & { onDrafted: () => void }) {
  const id = useId()
  const [pairs, setPairs] = useState(5)
  const [done, setDone] = useState('')
  const concepts = useQuery({ queryKey: conceptsKey, queryFn: listConcepts })
  const draft = useMutation({
    mutationFn: () => {
      if (!concepts.data?.length) throw new Error('Concepts did not load yet. Try again in a moment.')
      return draftTests(toDraftRequest(getValues(), concepts.data, pairs))
    },
    onMutate: () => setDone(''),
    onSuccess: (r) => {
      setValue('pre', r.pre as TestFV, { shouldDirty: true })
      setValue('post', r.post as TestFV, { shouldDirty: true })
      const extra = [r.usedTranscripts ? `read ${r.usedTranscripts} video transcript${r.usedTranscripts === 1 ? '' : 's'}` : '', r.dropped ? `left out ${r.dropped} that did not check out` : ''].filter(Boolean).join(', ')
      setDone(`Drafted ${r.pre.items.length} paired items${extra ? ` (${extra})` : ''}. Read every question and answer before you save: AI can be wrong.`)
      onDrafted()
    },
  })

  function start() {
    const v = getValues()
    const hasItems = (v.pre?.items.length ?? 0) + (v.post?.items.length ?? 0) > 0
    if (hasItems && !window.confirm('Replace the current pre-test and post-test with an AI draft?')) return
    draft.mutate()
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
      <p className="text-sm">
        <strong>Draft with AI:</strong> reads this module's lessons, readings, video transcripts and code tasks, and writes pairs of
        questions that test the same skill before and after. Only the lesson material is sent, never student data.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-pairs`}>Pairs of questions</Label>
          <select id={`${id}-pairs`} value={pairs} onChange={(e) => setPairs(Number(e.target.value))} className="min-h-11 rounded-md border bg-background px-3 py-2">
            {Array.from({ length: MAX_PAIRS - MIN_PAIRS + 1 }, (_, i) => MIN_PAIRS + i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <Button type="button" disabled={draft.isPending} onClick={start}>
          <Sparkles aria-hidden="true" /> {draft.isPending ? 'Drafting… (up to a minute)' : 'Draft both tests with AI'}
        </Button>
      </div>
      <p role="status" className="text-sm font-medium empty:hidden">{done}</p>
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{draft.error?.message}</p>
    </div>
  )
}
