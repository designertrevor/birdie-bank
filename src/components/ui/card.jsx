import * as React from 'react'

import { cn } from '@/lib/utils'

function Card({ className, ...props }) {
  return <div data-slot="card" className={cn('bg-transparent', className)} {...props} />
}

function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn(className)} {...props} />
}

function CardTitle({ className, ...props }) {
  return <div data-slot="card-title" className={cn(className)} {...props} />
}

function CardDescription({ className, ...props }) {
  return <div data-slot="card-description" className={cn(className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn(className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return <div data-slot="card-footer" className={cn(className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

