import React from 'react';
import { cn } from '../../utils/cn';

const badgeVariants = {
  variant: {
    default: 'border-gold/30 bg-gold/15 text-gold-light',
    gold: 'border-gold/30 bg-gold/15 text-gold-light',
    emerald: 'border-emerald/30 bg-emerald/15 text-emerald-light',
    success: 'border-emerald/30 bg-emerald/15 text-emerald-light',
    sky: 'border-sky-light/30 bg-sky-light/15 text-sky-light',
    blue: 'border-sky-light/30 bg-sky-light/15 text-sky-light',
    orange: 'border-orange/30 bg-orange/15 text-orange-light',
    warning: 'border-orange/30 bg-orange/15 text-orange-light',
    rose: 'border-danger/30 bg-danger/15 text-danger-light',
    destructive: 'border-danger/30 bg-danger/15 text-danger-light',
    danger: 'border-danger/30 bg-danger/15 text-danger-light',
    purple: 'border-orange/30 bg-orange/15 text-orange-light',
    secondary: 'border-line bg-surface text-fg-soft',
    outline: 'border-line bg-transparent text-fg'
  },
  size: {
    default: 'px-3 py-1 text-xs',
    sm: 'px-2 py-0.5 text-[0.7rem]'
  },
  dotColor: {
    default: 'bg-gold',
    gold: 'bg-gold',
    emerald: 'bg-emerald',
    success: 'bg-emerald',
    sky: 'bg-sky-light',
    blue: 'bg-sky-light',
    orange: 'bg-orange',
    warning: 'bg-orange',
    rose: 'bg-danger',
    destructive: 'bg-danger',
    danger: 'bg-danger',
    purple: 'bg-orange',
    secondary: 'bg-fg-muted',
    outline: 'bg-fg-muted'
  }
};

export const Badge = React.forwardRef(function Badge(
  {
    className,
    variant = 'default',
    size = 'default',
    dot = false,
    icon,
    children,
    ...props
  },
  ref
) {
  const variantClass = badgeVariants.variant[variant] || badgeVariants.variant.default;
  const sizeClass = badgeVariants.size[size] || badgeVariants.size.default;
  const dotClass = badgeVariants.dotColor[variant] || badgeVariants.dotColor.default;

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-sans font-semibold tracking-wide select-none',
        variantClass,
        sizeClass,
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
      )}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;
