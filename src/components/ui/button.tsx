import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Buttons are pills. Cards use 16px, inputs 10px - see globals.css for the
 * radius system.
 *
 * `accent` always pairs amber with near-black text. White on amber fails
 * WCAG AA at every lightness that still reads as amber.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full',
    // Only colour and transform animate. `transition-all` would also animate
    // layout properties, which forces relayout on hover.
    'font-medium transition-[background-color,color,transform,opacity] duration-150',
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong',
  ].join(' '),
  {
    variants: {
      variant: {
        accent: 'bg-accent text-accent-ink hover:bg-accent-strong',
        solid: 'bg-ink text-bg hover:opacity-90',
        outline:
          'border border-line bg-surface text-ink hover:bg-surface-sunk',
        ghost: 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
        live: 'bg-live text-white hover:opacity-90',
      },
      // Heights step up to a 44px finger target on small screens and settle
      // back to the tighter desktop scale from `sm` up.
      size: {
        sm: 'h-9 px-3 text-xs sm:h-8',
        md: 'h-11 px-4 text-sm sm:h-10',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: {
      variant: 'accent',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
