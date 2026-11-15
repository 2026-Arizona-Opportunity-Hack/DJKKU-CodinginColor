import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { fixList, submitModule } from './api'

type Props = {
  moduleId: string
  /** Unsaved changes in the form: they must be saved first, or the admin would review the old copy. */
  dirty: boolean
  /** Called with the database's warnings once the module is in the publish queue. */
  onSubmitted: (warnings: string[]) => void | Promise<void>
}

/**
 * Sends a saved draft to the CIC admins' publish queue (`submit_module`). Asks first, because a
 * submitted module is locked until an admin publishes it or sends it back. If the database finds
 * problems ("Fix these first: a; b"), they are listed one per line.
 */
export function SubmitForReview({ moduleId, dirty, onSubmitted }: Props) {
  const id = useId()
  const [confirming, setConfirming] = useState(false)
  const [needsSave, setNeedsSave] = useState(false)
  const submit = useMutation({
    mutationFn: () => submitModule(moduleId),
    onSuccess: (r) => onSubmitted(r.warnings),
    onError: () => setConfirming(false),
  })
  const problems = submit.error ? fixList(submit.error.message) : []

  const start = () => {
    if (dirty) {
      setNeedsSave(true)
      return
    }
    setNeedsSave(false)
    submit.reset()
    setConfirming(true)
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div role="group" aria-labelledby={`${id}-ask`} className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-950">
          <p id={`${id}-ask`} className="font-medium">
            Submit for review? You can't edit it while a CIC admin reviews it. They publish it or send it back to you.
          </p>
          <Button type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? 'Submitting…' : 'Yes, submit'}</Button>
          <Button type="button" variant="outline" disabled={submit.isPending} onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" size="lg" variant="outline" className="self-start" onClick={start}>Submit for review</Button>
      )}
      <p role="alert" className="text-sm font-medium text-destructive empty:hidden">{needsSave && dirty ? 'Save your changes first, then submit.' : ''}</p>
      <div role="alert" className="text-sm text-destructive empty:hidden">
        {problems.length > 0 && (
          <>
            <p className="font-medium">Fix these first, then save and submit again:</p>
            <ul className="list-disc pl-6">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </>
        )}
      </div>
    </div>
  )
}
