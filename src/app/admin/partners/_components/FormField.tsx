'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Label + error wrapper for controls that don't carry their own (Combobox,
 * Textarea). `Input`/`NumberInput` already render both — don't wrap those.
 */
export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-foreground-subtle">{hint}</p>}
    </div>
  );
}

FormField.displayName = 'FormField';
