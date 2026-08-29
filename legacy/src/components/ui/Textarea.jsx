import React from 'react';
import { cn } from '../../utils/cn';

export const Textarea = React.forwardRef(function Textarea(
  {
    className,
    error,
    helperText,
    disabled,
    rows = 3,
    ...props
  },
  ref
) {
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : null;

  return (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={cn(
          'flex min-h-[80px] w-full rounded-sm border border-line bg-field px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted outline-none transition-all duration-150',
          'focus:border-gold focus:ring-1 focus:ring-gold/30',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-field/40',
          hasError && 'border-danger focus:border-danger focus:ring-danger/30',
          className
        )}
        {...props}
      />
      {errorMessage && (
        <p className="mt-1.5 text-xs text-danger-light">{errorMessage}</p>
      )}
      {!errorMessage && helperText && (
        <p className="mt-1.5 text-xs text-fg-muted">{helperText}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
