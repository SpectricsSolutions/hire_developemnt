import { Input as InputPrimitive } from '@base-ui/react/input'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({
  className,
  type,
  'aria-invalid': ariaInvalid,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={ariaInvalid}
      className={cn(
        'border-input bg-input/30 file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-4xl border px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        ariaInvalid &&
          'border-destructive ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40 ring-[3px]',
        className
      )}
      {...props}
    />
  )
}

export { Input }
