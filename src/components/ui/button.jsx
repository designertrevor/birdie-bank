import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Keep an unstyled variant so existing custom classes remain in control.
        unstyled: '',
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-border bg-background text-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'bg-transparent text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        link: 'bg-transparent text-primary underline underline-offset-4',
      },
      size: {
        default: '',
        xs: '',
        sm: '',
        lg: '',
        icon: '',
        'icon-xs': '',
        'icon-sm': '',
        'icon-lg': '',
      },
    },
    defaultVariants: {
      variant: 'unstyled',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'unstyled',
  size = 'default',
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
