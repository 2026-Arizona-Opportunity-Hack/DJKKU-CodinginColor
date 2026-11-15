import { CheckCircle2, Circle, Lock, SkipForward } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { ItemStatus } from '../types'

const LOOK: Record<ItemStatus, { label: string; Icon: typeof Lock; className: string }> = {
  done: { label: 'Done', Icon: CheckCircle2, className: 'border-tint-green-edge bg-tint-green text-tint-green-fg' },
  available: { label: 'Ready', Icon: Circle, className: 'border-tint-cyan-edge bg-tint-cyan text-tint-cyan-fg' },
  locked: { label: 'Locked', Icon: Lock, className: 'border-border bg-muted text-muted-foreground' },
  skipped: { label: 'Skipped', Icon: SkipForward, className: 'border-border bg-white text-muted-foreground' },
}

/** Status shown with an icon AND a word, never by color alone (B12). */
export function StatusBadge({ status, className }: { status: ItemStatus; className?: string }) {
  const { label, Icon, className: look } = LOOK[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', look, className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  )
}
