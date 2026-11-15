import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CheckCircle2, Circle, Play, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Reading } from '@/components/learning/ActivityContent'
import type { CodeResponse } from '../content'
import { explainError } from '../code/explain'
import { createRunner, type RunOutcome, type Runner } from '../code/runner'

type Props = {
  content: { prompt: string; starter: string; predict?: string | null; tests: string[] }
  done: boolean
  pending: boolean
  onSubmit: (r: CodeResponse) => void
  actions?: ReactNode
}

/**
 * Python in the browser, PRIMM style (Sentance et al. 2019): Predict what the code does, Run it, then
 * Modify it until every check passes. No account, no install: Python runs on this device.
 */
export function CodeActivity({ content, done, pending, onSubmit, actions }: Props) {
  const id = useId()
  const runner = useRef<Runner | null>(null)
  const [code, setCode] = useState(content.starter)
  const [prediction, setPrediction] = useState('')
  const [running, setRunning] = useState(false)
  const [firstRun, setFirstRun] = useState(true)
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  useEffect(() => () => runner.current?.dispose(), [])

  const needsPrediction = Boolean(content.predict) && prediction.trim() === ''
  const checks = outcome?.kind === 'ok' ? outcome.checks : []
  const passed = checks.filter((c) => c.passed).length

  async function run() {
    runner.current ??= createRunner()
    setRunning(true)
    setOutcome(null)
    const result = await runner.current.run(code, content.tests)
    setOutcome(result)
    setRunning(false)
    setFirstRun(false)
  }

  // Tab inserts four spaces instead of leaving the editor; Escape then Tab still moves on (keyboard users).
  const escaped = useRef(false)
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { escaped.current = true; return }
    if (e.key !== 'Tab' || e.shiftKey || escaped.current) { escaped.current = false; return }
    e.preventDefault()
    const t = e.currentTarget
    const { selectionStart: s, selectionEnd: end } = t
    const next = `${code.slice(0, s)}    ${code.slice(end)}`
    setCode(next)
    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4 })
  }

  return (
    <div className="flex flex-col gap-5">
      <Reading markdown={content.prompt} />

      {content.predict && (
        <section aria-labelledby={`${id}-predict`} className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 id={`${id}-predict`} className="font-semibold">1. Predict</h2>
          <Label htmlFor={`${id}-prediction`}>{content.predict}</Label>
          <Textarea id={`${id}-prediction`} rows={2} value={prediction} onChange={(e) => setPrediction(e.target.value)} />
          <p className="text-sm text-muted-foreground">Guess before you run it. Being wrong is fine; it is how the code surprises you.</p>
        </section>
      )}

      <section aria-labelledby={`${id}-run`} className="flex flex-col gap-2">
        <h2 id={`${id}-run`} className="font-semibold">{content.predict ? '2. Run, then change the code' : 'Run, then change the code'}</h2>
        <Label htmlFor={`${id}-code`}>Your code (Python)</Label>
        <Textarea
          id={`${id}-code`}
          rows={Math.min(18, Math.max(6, code.split('\n').length + 1))}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-describedby={`${id}-tab`}
          className="font-mono text-sm"
        />
        <p id={`${id}-tab`} className="text-xs text-muted-foreground">Tab adds 4 spaces. Press Escape, then Tab, to leave the editor.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={running || needsPrediction} onClick={() => void run()}>
            <Play aria-hidden="true" /> {running ? (firstRun ? 'Loading Python…' : 'Running…') : 'Run'}
          </Button>
          <Button type="button" variant="outline" disabled={running} onClick={() => { setCode(content.starter); setOutcome(null) }}>
            <RotateCcw aria-hidden="true" /> Start over
          </Button>
          {needsPrediction && <span className="text-sm">Write your prediction first.</span>}
          {running && firstRun && <span role="status" className="text-sm">The first run downloads Python, which takes a few seconds.</span>}
        </div>
      </section>

      <div aria-live="polite" className="flex flex-col gap-3">
        {outcome?.kind === 'timeout' && (
          <p role="alert" className="rounded-md border border-warning/40 bg-warning-muted p-3 text-warning">
            Your code ran for more than 5 seconds, so it was stopped. Is there a loop that never ends? Check that something changes each time round.
          </p>
        )}
        {outcome?.kind === 'unavailable' && <p role="alert" className="rounded-md border p-3">{outcome.message}</p>}
        {outcome?.kind === 'ok' && (
          <>
            <figure>
              <figcaption className="mb-1 text-sm font-medium">Output</figcaption>
              <pre className="min-h-12 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm whitespace-pre-wrap">{outcome.stdout || '(nothing was printed)'}</pre>
            </figure>
            {outcome.error && (
              <div role="alert" className="rounded-md border border-destructive/50 p-3">
                <p className="font-medium">{explainError(outcome.error)}</p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{outcome.error.type}: {outcome.error.message}</p>
              </div>
            )}
          </>
        )}
      </div>

      {content.tests.length > 0 && (
        <section aria-labelledby={`${id}-checks`} className="flex flex-col gap-2">
          <h2 id={`${id}-checks`} className="font-semibold">{content.predict ? '3. Make every check pass' : 'Make every check pass'}</h2>
          <ul className="flex flex-col gap-1">
            {content.tests.map((t, i) => {
              const c = checks[i]
              const Icon = !c ? Circle : c.passed ? CheckCircle2 : XCircle
              return (
                <li key={`${t}-${i}`} className="flex flex-wrap items-center gap-2">
                  <Icon aria-hidden="true" className={`size-4 ${!c ? 'text-muted-foreground' : c.passed ? 'text-success' : 'text-destructive'}`} />
                  <code className="rounded bg-muted px-1 font-mono text-sm">{t}</code>
                  <span className="text-sm">{!c ? 'Not run yet' : c.passed ? 'Passes' : `Not yet${c.error ? `: ${c.error}` : ''}`}</span>
                </li>
              )
            })}
          </ul>
          {checks.length > 0 && <p className="text-sm font-medium">{passed} of {content.tests.length} checks pass.</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!done && (
          <Button
            size="lg"
            disabled={pending || outcome?.kind !== 'ok'}
            onClick={() => onSubmit({ code, passed, total: content.tests.length, ...(prediction.trim() ? { prediction: prediction.trim() } : {}) })}
          >
            {pending ? 'Saving…' : 'Submit my code'}
          </Button>
        )}
        {outcome?.kind !== 'ok' && !done && <span className="text-sm text-muted-foreground">Run your code first, then submit it.</span>}
        {actions}
      </div>
    </div>
  )
}
