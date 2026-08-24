import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const buttonVariants = {
  variant: {
    default:
      'bg-linear-135 from-gold to-gold-dark text-white shadow-sm hover:-translate-y-px hover:shadow-gold active:translate-y-0',
    primary:
      'bg-linear-135 from-gold to-gold-dark text-white shadow-sm hover:-translate-y-px hover:shadow-gold active:translate-y-0',
    gold:
      'bg-linear-135 from-gold to-gold-dark text-white shadow-sm hover:-translate-y-px hover:shadow-gold active:translate-y-0',
    emerald:
      'bg-linear-135 from-emerald to-emerald-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(16,185,129,0.25)] active:translate-y-0',
    success:
      'bg-linear-135 from-emerald to-emerald-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(16,185,129,0.25)] active:translate-y-0',
    sky:
      'bg-linear-135 from-sky to-sky-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(2,132,199,0.25)] active:translate-y-0',
    info:
      'bg-linear-135 from-sky to-sky-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(2,132,199,0.25)] active:translate-y-0',
    orange:
      'bg-linear-135 from-orange to-orange-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(249,115,22,0.25)] active:translate-y-0',
    warning:
      'bg-linear-135 from-orange to-orange-dark text-white shadow-sm hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(249,115,22,0.25)] active:translate-y-0',
    outline:
      'border border-line bg-field/40 text-fg hover:border-line-hover hover:bg-white/[0.04] hover:text-gold active:bg-white/[0.02]',
    secondary:
      'border border-line bg-field/40 text-fg-soft hover:border-line-hover hover:bg-white/[0.04] hover:text-fg active:bg-white/[0.02]',
    ghost:
      'bg-transparent text-fg-soft hover:bg-white/[0.05] hover:text-fg active:bg-white/[0.02]',
    destructive:
      'border border-danger/30 bg-danger/15 text-danger-light hover:bg-danger/25 hover:border-danger/50 active:bg-danger/20',
    danger:
      'border border-danger/30 bg-danger/15 text-danger-light hover:bg-danger/25 hover:border-danger/50 active:bg-danger/20',
    link:
      'text-gold-light underline-offset-4 hover:underline bg-transparent p-0 h-auto'
  },
  size: {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base font-semibold',
    icon: 'h-10 w-10 p-0 flex items-center justify-center',
    'icon-sm': 'h-8 w-8 p-0 flex items-center justify-center'
  }
};

export const Button = React.forwardRef(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    isLoading = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isBusy = isLoading || loading;
  const variantClass = buttonVariants.variant[variant] || buttonVariants.variant.default;
  const sizeClass = buttonVariants.size[size] || buttonVariants.size.default;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isBusy}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-sans font-semibold cursor-pointer select-none transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass,
        sizeClass,
        className
      )}
      {...props}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin text-current" />
      ) : leftIcon ? (
        <span className="shrink-0 flex items-center">{leftIcon}</span>
      ) : null}
      {children}
      {!isBusy && rightIcon ? (
        <span className="shrink-0 flex items-center">{rightIcon}</span>
      ) : null}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
