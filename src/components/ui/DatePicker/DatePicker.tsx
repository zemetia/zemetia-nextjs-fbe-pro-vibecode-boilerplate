'use client';

import { useId, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatDateLong, today } from '@/lib/date';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from './Calendar';

export interface DatePickerProps {
  /** Selected day. `undefined`/`null` renders the placeholder. */
  value?: Date | null;
  onChange?: (value: Date | undefined) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Earliest selectable day, inclusive. */
  minDate?: Date;
  /** Latest selectable day, inclusive — pass `new Date()` to block the future. */
  maxDate?: Date;
  /** Show the clear affordance. Defaults to off for required fields. */
  clearable?: boolean;
  className?: string;
  id?: string;
}

/**
 * Day picker in a popover, wearing the same label/hint/error chrome as `Input`
 * so it lines up inside a form grid. It hands back a `Date` at local midnight;
 * serialise it with `toDateOnly()` from `@/lib/date` before sending it to an
 * API, never with `toISOString()` — that shifts the day across time zones.
 */
export function DatePicker({
  value,
  onChange,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  placeholder = 'Pilih tanggal',
  minDate,
  maxDate,
  clearable = !required,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const selected = value ?? undefined;
  /** A required field keeps its value; an optional one gets a clear affordance. */
  const canClear = clearable && !!selected && !disabled;

  /** The "Hari ini" shortcut only makes sense while today is inside the range. */
  const now = today();
  const todayAllowed = (!minDate || now >= minDate) && (!maxDate || now <= maxDate);

  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="text-foreground text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={fieldId}
              type="button"
              disabled={disabled}
              // `aria-invalid` is not allowed on a button role; the message is
              // announced through `aria-describedby` + `role="alert"` instead.
              data-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
              className={cn(
                'bg-surface flex h-9 w-full items-center gap-2 rounded-md border pl-3 text-sm shadow-xs',
                'transition-[color,box-shadow,border-color] duration-150',
                'focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:outline-none',
                'data-[state=open]:border-ring data-[state=open]:ring-ring/25 data-[state=open]:ring-[3px]',
                'disabled:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60',
                error
                  ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25'
                  : 'border-input hover:border-border-strong',
                canClear ? 'pr-9' : 'pr-3',
              )}
            >
              <CalendarDays className="text-foreground-muted h-4 w-4 shrink-0" aria-hidden="true" />
              <span className={cn('truncate', !selected && 'text-foreground-subtle')}>
                {selected ? formatDateLong(selected) : placeholder}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              autoFocus
              startMonth={minDate}
              endMonth={maxDate}
              disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
              onQuickSelect={
                todayAllowed
                  ? (next) => {
                      onChange?.(next);
                      setOpen(false);
                    }
                  : undefined
              }
              onClear={
                canClear
                  ? () => {
                      onChange?.(undefined);
                      setOpen(false);
                    }
                  : undefined
              }
              onSelect={(next) => {
                onChange?.(next);
                if (next) setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        {canClear && (
          <button
            type="button"
            aria-label="Hapus tanggal"
            onClick={() => onChange?.(undefined)}
            className={cn(
              'absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center',
              'text-foreground-subtle rounded-md transition-colors duration-150',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:outline-none',
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${fieldId}-hint`} className="text-foreground-subtle text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

DatePicker.displayName = 'DatePicker';
