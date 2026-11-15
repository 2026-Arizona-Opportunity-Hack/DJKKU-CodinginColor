import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * Coding in Color's `< IN >` mark, traced from the official logo (src/assets/brand/) and
 * shaded like the app mockup: the left chevron runs deep to mid green, the right one mid to
 * light mint, each with a lighter bevel edge. Decorative wherever the name is also written as
 * text, so it is hidden from screen readers. useId keeps gradient ids unique per instance.
 */
export function CicMark({ className, withIn = true }: { className?: string; withIn?: boolean }) {
  const id = useId()
  const left = `${id}-l`
  const right = `${id}-r`
  return (
    <svg viewBox="0 0 732 640" aria-hidden="true" focusable="false" className={cn('h-8 w-auto', className)}>
      <defs>
        <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f9a55" />
          <stop offset="1" stopColor="#0b5e31" />
        </linearGradient>
        <linearGradient id={right} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9be8bb" />
          <stop offset="1" stopColor="#2fae64" />
        </linearGradient>
      </defs>
      <path fill={`url(#${left})`} d="M0 228 228 0h20v166L95 319l153 155v166L0 392Z" />
      <path fill="#5fd391" d="M0 228 228 0h20L10 238v162l-10-8Z" />
      <path fill={`url(#${right})`} d="M484 0h10l238 236v166L494 640l-10-10V464l156-152-156-156Z" />
      <path fill="#d2f6e0" d="M484 0h10v166l-10-10Zm0 464 156-152 8 8-154 154v166l-10-10Z" />
      {withIn && (
        <text
          x="366"
          y="356"
          textAnchor="middle"
          fontFamily="'Courier Prime', 'Courier New', monospace"
          fontWeight="700"
          fontSize="112"
          fill="#0b5e31"
        >
          IN
        </text>
      )}
    </svg>
  )
}

/** Mark plus the "CODING IN COLOR" wordmark: bold Courier, uppercase, wide tracking, dark green. */
export function CicLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* No "IN" at this size: it is unreadable at 32 px, and as text inside the home link it would
          not match the link's accessible name (axe rule label-content-name-mismatch, CI smoke test). */}
      <CicMark className="h-8" withIn={false} />
      <span className="font-display text-[0.9375rem] font-bold tracking-[0.14em] text-secondary-foreground uppercase sm:text-base">
        Coding in Color
      </span>
    </span>
  )
}
