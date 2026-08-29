import React from 'react';
import { cn } from '../../utils/cn';

export const Table = React.forwardRef(function Table(
  { className, containerClassName, children, ...props },
  ref
) {
  return (
    <div
      className={cn(
        'table-container relative w-full overflow-x-auto rounded-md border border-line bg-surface/30 shadow-glass backdrop-blur-[12px]',
        containerClassName
      )}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm tabular-nums', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
});
Table.displayName = 'Table';

export const TableHeader = React.forwardRef(function TableHeader(
  { className, ...props },
  ref
) {
  return (
    <thead
      ref={ref}
      className={cn('[&_tr]:border-b [&_tr]:border-gold/25', className)}
      {...props}
    />
  );
});
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef(function TableBody(
  { className, ...props },
  ref
) {
  return (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
});
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef(function TableFooter(
  { className, ...props },
  ref
) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        'border-t-2 border-gold/30 bg-surface/90 font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  );
});
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef(function TableRow(
  { className, ...props },
  ref
) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-line transition-colors duration-150 even:bg-white/[0.015] hover:bg-gold/[0.05] data-[state=selected]:bg-gold/[0.08]',
        className
      )}
      {...props}
    />
  );
});
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef(function TableHead(
  { className, ...props },
  ref
) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-11 px-4 py-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-fg-soft whitespace-nowrap bg-surface/90 [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef(function TableCell(
  { className, ...props },
  ref
) {
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3.5 align-middle text-fg [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef(function TableCaption(
  { className, ...props },
  ref
) {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-xs text-fg-muted', className)}
      {...props}
    />
  );
});
TableCaption.displayName = 'TableCaption';

export const TableEmpty = React.forwardRef(function TableEmpty(
  { colSpan = 1, className, children, icon, title, message, ...props },
  ref
) {
  return (
    <tr ref={ref} {...props}>
      <td
        colSpan={colSpan}
        className={cn('py-12 text-center text-fg-muted', className)}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          {icon && <div className="text-fg-muted/60 mb-1">{icon}</div>}
          {title && <p className="font-semibold text-fg-soft text-sm">{title}</p>}
          <p className="text-xs text-fg-muted">
            {children || message || 'Belum ada data untuk ditampilkan.'}
          </p>
        </div>
      </td>
    </tr>
  );
});
TableEmpty.displayName = 'TableEmpty';
