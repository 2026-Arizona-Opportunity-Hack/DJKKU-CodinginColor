import { CheckCircle2, Circle, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { ItemStatus } from '../types'

const LOOK: Record<ItemStatus, { label: string; Icon: typeof Lock; className: string }> = {
  done: { label: 'Done', Icon: CheckCircle2, className: 'bg-success-muted text-success' },
  available: { label: 'Ready', Icon: Circle, className: 'bg-secondary text-secondary-foreground' },
  locked: { label: 'Locked', Icon: Lock, className: 'bg-muted text-muted-foreground' },
}

/** Status shown with an icon AND a word, never by color alone (B12). */
export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  const { label, Icon, className: look } = LOOK[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', look, className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  )
}
