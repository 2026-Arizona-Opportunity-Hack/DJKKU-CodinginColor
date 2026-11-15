import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[color,background-color,box-shadow,filter] disabled:pointer-events-none disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default: 'bg-(image:--gradient-primary) bg-primary text-primary-foreground shadow-(--shadow-glow) ring-1 ring-inset ring-white/15 hover:bg-primary-hover hover:bg-none',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline: 'gradient-edge text-foreground shadow-xs',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-tint-green',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 underline hover:no-underline',
      },
      // Every size meets the 44 px touch-target goal (B11).
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-11 rounded-md px-3',
        lg: 'min-h-12 rounded-md px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button }
