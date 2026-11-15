// Lightweight visuals. No chart library: every visual here is decoration only (aria-hidden), and the
// number it shows is always printed as text next to it, so screen readers and print get the data.

/** A horizontal bar from 0 to 100, with an optional class marker. */
export function Bar({ value, marker, tone = 'primary' }: { value: number | null; marker?: number | null; tone?: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const fill = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive' }[tone]
  return (
    <div aria-hidden="true" className="relative h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${v}%` }} />
      {marker !== null && marker !== undefined && (
        <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${Math.max(0, Math.min(100, marker))}%` }} />
      )}
    </div>
  )
}

/** Four weeks of activity, oldest first. Each day says its count in words for screen readers. */
export function ActivityCalendar({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <ol aria-label="Activity in the last four weeks" className="grid w-fit list-none grid-cols-7 gap-1 pl-0">
      {days.map((d) => {
        const level = d.count === 0 ? 0 : Math.ceil((d.count / max) * 3)
        const shade = ['bg-muted', 'bg-primary/40', 'bg-primary/70', 'bg-primary'][level]
        return (
          <li key={d.date} className="flex">
            <span aria-hidden="true" title={`${label(d.date)}: ${d.count}`} className={`size-5 rounded-sm border ${shade}`} />
            <span className="sr-only">{`${label(d.date)}: ${d.count === 0 ? 'no activity' : `${d.count} action${d.count === 1 ? '' : 's'}`}`}</span>
          </li>
        )
      })}
    </ol>
  )
}
