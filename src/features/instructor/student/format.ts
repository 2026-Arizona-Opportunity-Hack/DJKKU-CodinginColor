// Small display helpers for the student page.

export function duration(seconds: number): string {
  if (seconds < 60) return seconds === 0 ? '0 min' : '< 1 min'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'
}

export function daysAgo(days: number | null): string {
  if (days === null) return 'never'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n)}%`)

export const signedPoints = (n: number | null) => (n === null ? 'Incomplete' : `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} pts`)
