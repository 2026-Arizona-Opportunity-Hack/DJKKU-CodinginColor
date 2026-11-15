import type { ReviewActivity } from './api'

export const KIND_LABEL: Record<ReviewActivity['kind'], string> = {
  video: 'Video',
  reading: 'Reading',
  check: 'Check for understanding',
  worksheet: 'Worksheet',
  exit: 'Exit question',
}

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'not published'
