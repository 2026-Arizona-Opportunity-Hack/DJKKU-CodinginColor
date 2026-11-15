import { CheckCircle2, Info, PartyPopper, XCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import type { SubmitResult } from '../types'

// Shown with a wrong answer. "Struggle is normal" framing helps students who wonder if they belong in
// computing (Walton and Cohen 2011). Picked from the feedback text so it stays the same on re-render.
const GROWTH = [
  'Getting it wrong first is normal: most programmers try a few times before code works.',
  'Every coder gets stuck. A wrong try shows you what to change next.',
  'This one trips up lots of people the first time. Look at the hint or the example, then try again.',
]
function growthLine(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GROWTH[h % GROWTH.length]!
}

/** Correct / not yet / saved, each with an icon and words (never color alone), plus the unlock message. */
export function ResultMessage({ result }: { result: SubmitResult }) {
  const look =
    result.is_correct === true
      ? { variant: 'success' as const, Icon: CheckCircle2, title: 'Correct' }
      : result.is_correct === false
        ? { variant: 'warning' as const, Icon: XCircle, title: 'Not yet' }
        : { variant: 'default' as const, Icon: Info, title: 'Saved' }
  return (
    <div className="flex flex-col gap-3">
      <Alert variant={look.variant}>
        <look.Icon aria-hidden="true" />
        <AlertTitle>{look.title}</AlertTitle>
        {(result.feedback || result.explanation) && (
          <AlertDescription>
            {result.feedback && <p>{result.feedback}</p>}
            {result.explanation && <p>{result.explanation}</p>}
          </AlertDescription>
        )}
        {result.is_correct === false && <AlertDescription><p className="text-sm">{growthLine(result.feedback ?? '')}</p></AlertDescription>}
      </Alert>
      {result.module_completed && (
        <Alert variant="success">
          <PartyPopper aria-hidden="true" />
          <AlertTitle>
            {result.unlocked_module_title
              ? `Module complete, ${result.unlocked_module_title} unlocked`
              : 'Module complete'}
          </AlertTitle>
          <AlertDescription>
            <p>Your post-test for this module is ready on your path.</p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
