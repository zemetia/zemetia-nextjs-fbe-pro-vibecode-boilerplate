import React from 'react';
import { cn } from '../../utils/cn';

export const Card = React.forwardRef(function Card(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-md border border-line bg-card shadow-glass backdrop-blur-[16px] transition-all duration-200 hover:border-line-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader = React.forwardRef(function CardHeader(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef(function CardTitle(
  { className, children, ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={cn(
        'font-heading text-lg font-bold tracking-tight text-fg flex items-center gap-2',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef(function CardDescription(
  { className, children, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn('text-xs text-fg-soft font-sans', className)}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef(function CardContent(
  { className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef(function CardFooter(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = 'CardFooter';

export default Card;
