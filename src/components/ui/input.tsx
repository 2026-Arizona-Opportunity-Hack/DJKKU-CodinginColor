import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-ring',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
