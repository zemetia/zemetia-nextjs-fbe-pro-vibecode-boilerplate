import React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(function Input(
  {
    className,
    type = 'text',
    leftIcon,
    rightIcon,
    error,
    helperText,
    disabled,
    ...props
  },
  ref
) {
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : null;

  return (
    <div className="w-full">
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="pointer-events-none absolute left-3 flex items-center justify-center text-fg-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-sm border border-line bg-field px-3.5 py-2 text-sm text-fg placeholder:text-fg-muted outline-none transition-all duration-150',
            'focus:border-gold focus:ring-1 focus:ring-gold/30',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-field/40',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            hasError && 'border-danger focus:border-danger focus:ring-danger/30 text-danger-light',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="pointer-events-none absolute right-3 flex items-center justify-center text-fg-muted">
            {rightIcon}
          </div>
        )}
      </div>
      {errorMessage && (
        <p className="mt-1.5 text-xs text-danger-light">{errorMessage}</p>
      )}
      {!errorMessage && helperText && (
        <p className="mt-1.5 text-xs text-fg-muted">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
