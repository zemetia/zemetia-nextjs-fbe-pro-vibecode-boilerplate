import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Select = React.forwardRef(function Select(
  {
    className,
    children,
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
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full appearance-none rounded-sm border border-line bg-field px-3.5 py-2 pr-10 text-sm text-fg outline-none transition-all duration-150 cursor-pointer',
            'focus:border-gold focus:ring-1 focus:ring-gold/30',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-field/40',
            hasError && 'border-danger focus:border-danger focus:ring-danger/30',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 flex items-center justify-center text-fg-muted">
          <ChevronDown className="h-4 w-4" />
        </div>
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

Select.displayName = 'Select';

export default Select;
