'use client';

import { TriangleAlert } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

const errorStateVariants = cva('flex items-start gap-3 text-left', {
  variants: {
    variant: {
      /** Boxed panel — for a failed page, section, or card. */
      panel: 'rounded-lg border border-border bg-surface px-4 py-4',
      /** Bare text — for a failed row inside a table or list. */
      inline: 'px-0 py-6 justify-center text-center',
    },
  },
  defaultVariants: { variant: 'panel' },
});

export interface ErrorStateProps extends VariantProps<typeof errorStateVariants> {
  /**
   * What went wrong, in words the user can act on. Required — an error state
   * without a message is not allowed (docs/blueprint/ERROR_HANDLING.md).
   * Build it with `apiErrorMessage(error, fallback)`, never `error.message`
   * of an unknown throw and never a status code or stack.
   */
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  message,
  title,
  onRetry,
  retryLabel = 'Coba lagi',
  variant,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn(errorStateVariants({ variant }), className)}>
      {variant !== 'inline' && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <p className="text-sm text-foreground-muted">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

ErrorState.displayName = 'ErrorState';
