"use client"

import * as React from "react"

import { cn } from "@/lib/cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="table-container relative w-full overflow-x-auto rounded-md border border-line bg-surface/30 shadow-glass backdrop-blur-[12px]"
    >
      <table
        data-slot="table"
        className={cn("custom-table w-full caption-bottom text-sm tabular-nums", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-surface/90 [&_tr]:border-b [&_tr]:border-gold/25",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t-2 border-gold/30 bg-surface/90 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-line transition-colors duration-150 even:bg-white/[0.015] hover:bg-gold/[0.05] data-[state=selected]:bg-gold/[0.08]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 py-3.5 text-left align-middle text-xs font-semibold tracking-wider text-fg-soft uppercase whitespace-nowrap bg-surface/90 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3.5 align-middle whitespace-nowrap text-fg [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-xs text-fg-muted", className)}
      {...props}
    />
  )
}

function TableEmpty({
  colSpan,
  message = "Belum ada data",
  className,
}: {
  colSpan: number
  message?: string
  className?: string
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn("py-12 text-center text-fg-muted", className)}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-xs text-fg-muted">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
}
