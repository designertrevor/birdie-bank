import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

function SheetOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    />
  )
}

function SheetContent({ className, side = 'right', ...props }) {
  const sideClasses =
    side === 'left'
      ? 'left-0 top-0 h-full w-80'
      : side === 'right'
        ? 'right-0 top-0 h-full w-80'
        : side === 'top'
          ? 'left-0 top-0 w-full h-1/3'
          : 'left-0 bottom-0 w-full h-1/3'

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-card text-card-foreground border border-border p-4 shadow-lg',
          sideClasses,
          className
        )}
        {...props}
      />
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }) {
  return <div className={cn(className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div className={cn(className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn(className)} {...props} />
}

function SheetDescription({ className, ...props }) {
  return <DialogPrimitive.Description className={cn(className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

