import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-md font-medium leading-none tracking-tight',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    'active:translate-y-px',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bevel bg-linear-to-b from-primary to-primary-hover text-primary-foreground',
          'hover:from-primary-hover hover:to-primary-active',
          'shadow-sm hover:shadow-md',
        ],
        secondary: [
          'bg-surface text-foreground border border-border shadow-xs',
          'hover:bg-surface-raised hover:border-border-strong hover:shadow-sm',
        ],
        outline: [
          'border border-border-strong bg-transparent text-foreground',
          'hover:border-primary hover:bg-primary-subtle hover:text-primary',
        ],
        ghost: [
          'bg-transparent text-foreground-muted',
          'hover:bg-primary-subtle hover:text-primary',
        ],
        soft: [
          'bg-primary-subtle text-primary border border-primary/15',
          'hover:bg-primary-muted hover:border-primary/25',
        ],
        brand: [
          'bevel bg-linear-to-b from-brand to-brand-hover text-brand-foreground',
          'hover:from-brand-hover hover:to-brand-hover',
          'shadow-sm hover:shadow-md',
        ],
        destructive: [
          'bevel bg-linear-to-b from-destructive to-destructive-hover text-destructive-foreground',
          'hover:from-destructive-hover hover:to-destructive-hover',
          'shadow-sm hover:shadow-md',
        ],
        link: ['bg-transparent text-primary underline-offset-4 hover:underline active:translate-y-0'],
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-base',
        xl: 'h-12 px-8 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {isLoading ? <Spinner /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
