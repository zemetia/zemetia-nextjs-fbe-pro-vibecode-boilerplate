'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Dedicated Tan-ERP styled Table component specifically for Chart of Accounts (COA).
 * Matches the exact clean, compact design tokens from tan-erp.
 */
export function CoaTable({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="coa-table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="coa-table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function CoaTableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="coa-table-header"
      className={cn(
        'bg-surface-raised [&_tr]:border-b [&_tr]:border-border',
        className,
      )}
      {...props}
    />
  );
}

export function CoaTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="coa-table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

export function CoaTableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="coa-table-footer"
      className={cn(
        'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export function CoaTableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="coa-table-row"
      className={cn(
        'border-b border-border transition-colors hover:bg-primary-subtle/60 has-aria-expanded:bg-primary-subtle/60 data-[state=selected]:bg-primary-subtle',
        className,
      )}
      {...props}
    />
  );
}

export function CoaTableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="coa-table-head"
      className={cn(
        'h-10 px-2 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-foreground-muted uppercase [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

export function CoaTableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="coa-table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

export function CoaTableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="coa-table-caption"
      className={cn('mt-4 text-sm text-foreground-muted', className)}
      {...props}
    />
  );
}

export function CoaTableEmpty({
  colSpan,
  message = 'Tidak ada akun yang sesuai dengan pencarian',
  className,
}: {
  colSpan: number;
  message?: string;
  className?: string;
}) {
  return (
    <CoaTableRow>
      <CoaTableCell
        colSpan={colSpan}
        className={cn('py-12 text-center text-foreground-muted', className)}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-sm">{message}</p>
        </div>
      </CoaTableCell>
    </CoaTableRow>
  );
}
