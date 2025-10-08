import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base gaming input styling
        'h-9 w-full min-w-0 rounded-3xl px-3 py-1 text-xs outline-none',
        'text-overlay-text-primary placeholder:text-overlay-text-secondary placeholder:text-xs',

        // Gaming selection styling
        'selection:bg-overlay-accent-primary selection:text-overlay-bg-primary',

        // File input gaming styling
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:px-2 file:py-1',
        'file:text-sm file:font-medium file:text-overlay-text-secondary',
        'file:hover:text-overlay-accent-primary',

        // Gaming disabled state
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        'disabled:opacity-50 disabled:bg-overlay-bg-primary',
        'disabled:text-overlay-text-muted',

        // Gaming invalid state
        'aria-invalid:border-red-400/60 aria-invalid:shadow-[0_0_0_2px_rgba(239,68,68,0.3)]',
        'aria-invalid:bg-overlay-bg-secondary',

        // Gaming transitions
        'transition-all duration-200 ease-in-out',

        className
      )}
      {...props}
    />
  )
}

export { Input }
