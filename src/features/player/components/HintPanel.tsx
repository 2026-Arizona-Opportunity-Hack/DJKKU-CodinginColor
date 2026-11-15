import { useState } from 'react'
import { Lightbulb } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ActivityResponse } from '@/features/player/content'

import { describeError } from '../errors'
import { useRequestHint } from '../queries'

export const HINT_LIMIT = 3
const FALLBACK = "Hints aren't available right now. Re-read the question, look back at the lesson, or ask your instructor."

/**
 * B9: "Get a hint" after a wrong answer. Hint text is plain text (never HTML). Any failure
 * shows a friendly fallback; the lesson keeps working.
 */
export function HintPanel({ activityId, lastResponse }: { activityId: string; lastResponse: ActivityResponse }) {
  const hint = useRequestHint(activityId)
  const [hints, setHints] = useState<string[]>([])
  const [remaining, setRemaining] = useState(HINT_LIMIT)
  const failure = hint.isError ? describeError(hint.error) : null
  const exhausted = remaining <= 0 || hints.length >= HINT_LIMIT || failure?.code === 'rate_limited'

  function ask() {
    hint.mutate(lastResponse, {
      onSuccess: (r) => {
        setHints((h) => [...h, r.hint])
        setRemaining(r.remaining)
      },
    })
  }

  return (
    <section aria-label="Hints" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={ask} disabled={hint.isPending || exhausted}>
          <Lightbulb aria-hidden="true" />
          {hint.isPending ? 'Getting a hint…' : 'Get a hint'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {exhausted ? 'No hints left for this question.' : `${remaining} of ${HINT_LIMIT} left`}
        </span>
      </div>
      <div aria-live="polite" className="flex flex-col gap-2">
        {hints.map((text, i) => (
          <p key={i} className="rounded-lg border border-l-4 border-tint-yellow-edge bg-tint-yellow p-3 text-foreground">
            <span className="font-semibold">Hint {i + 1}: </span>
            {text}
          </p>
        ))}
        {failure && (
          <p className="rounded-md bg-muted p-3">
            {failure.code === 'rate_limited' ? "You've used the hints for now. " : ''}
            {FALLBACK}
            {failure.reference && <span className="block text-xs text-muted-foreground">Reference: {failure.reference}</span>}
          </p>
        )}
      </div>
    </section>
  )
}
