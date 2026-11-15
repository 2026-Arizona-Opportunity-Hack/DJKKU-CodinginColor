import { useCatchUp } from '@/features/player/queries'

/**
 * "Missed class? Here is your plan." Absence compounds, so a student who falls behind sees exactly what is
 * left and roughly how long it takes, in friendly words. Minutes are what classmates actually spent.
 */
export function CatchUpPlan({ classId }: { classId: string }) {
  const plan = useCatchUp(classId)
  if (plan.isPending) return null // the main card already shows a loading state
  if (plan.isError) return <p className="mt-4 text-sm text-muted-foreground">Your catch-up plan didn't load. Your next step above still works.</p>
  const p = plan.data
  if (p.steps_left === 0) return null
  const behind = p.behind_by > 0
  return (
    <section aria-labelledby={`catch-up-${classId}`} className="mt-4 rounded-lg border p-4">
      <h3 id={`catch-up-${classId}`} className="font-semibold">{behind ? 'Your catch-up plan' : 'What is left'}</h3>
      <p className="mt-1">
        {behind
          ? `You are ${p.behind_by} step${p.behind_by === 1 ? '' : 's'} behind the class. That happens, and it is fixable: `
          : ''}
        {p.steps_left} step{p.steps_left === 1 ? '' : 's'} left, about {p.minutes_left} minute{p.minutes_left === 1 ? '' : 's'}.
      </p>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer content-center font-medium">See the steps</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-6">
          {p.steps.map((s, i) => (
            <li key={`${s.activity_id ?? s.assessment_id}-${i}`}>
              {s.title} <span className="text-sm text-muted-foreground">(about {s.minutes} min)</span>
            </li>
          ))}
        </ol>
        {p.steps_left > p.steps.length && <p className="mt-1 text-sm text-muted-foreground">And {p.steps_left - p.steps.length} more after these.</p>}
      </details>
    </section>
  )
}
