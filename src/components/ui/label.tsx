"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/cn"

export interface LabelProps
  extends React.ComponentProps<typeof LabelPrimitive.Root> {
  required?: boolean;
}

function Label({
  className,
  children,
  required,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-danger font-bold text-xs ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  )
}

export { Label }
