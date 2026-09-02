import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  /** Gradient hairline across the top edge — for the lead card on a page. */
  accent?: boolean;
  /** Lifts on hover; use only when the whole card is a link or button. */
  interactive?: boolean;
}

export function Card({
  noPadding = false,
  accent = false,
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-md border border-line bg-card text-card-foreground shadow-glass backdrop-blur-[16px]',
        // Only clip when there is a bar to clip — otherwise focus rings and
        // sticky children inside the card get cut off.
        accent && 'overflow-hidden',
        interactive &&
          'transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-line-hover hover:shadow-md',
        !noPadding && 'p-6',
        className,
      )}
      {...props}
    >
      {accent && (
        <span
          className="accent-bar absolute inset-x-0 top-0 h-0.5"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-foreground-muted leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center pt-4', className)} {...props}>
      {children}
    </div>
  );
}
