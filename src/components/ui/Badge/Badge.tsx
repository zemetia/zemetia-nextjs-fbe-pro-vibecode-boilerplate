import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-full font-medium',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary-subtle text-primary border border-primary/20',
        solid: 'bevel bg-primary text-primary-foreground shadow-xs',
        secondary: 'bg-surface-raised text-foreground-muted border border-border',
        outline: 'border border-border bg-surface text-foreground-muted shadow-xs',
        brand: 'bg-brand-subtle text-brand-foreground border border-brand/35',
        info: 'bg-info-subtle text-info border border-info/25',
        destructive: 'bg-destructive-subtle text-destructive border border-destructive/25',
        success: 'bg-success-subtle text-success border border-success/25',
        warning: 'bg-warning-subtle text-warning-foreground border border-warning/40',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, BadgeVariants {
  dot?: boolean;
}

export function Badge({ variant, size, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
