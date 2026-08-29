'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Pill switch for choosing one of a few mutually exclusive modes — the tab strip
 * above a list, or the type switch at the top of a form. Elevation carries the
 * selection: the track is a sunken muted fill and the active pill is a raised
 * `surface` card, which is how "not flat" reads in light mode (see
 * docs/blueprint/DESIGN_SYSTEM/01-tokens-colors.md).
 *
 * Semantics are a radio group, not tabs: it reports the chosen value and never
 * assumes a `tabpanel` exists on the other end.
 */

const trackVariants = cva('inline-flex items-center gap-1 rounded-full border border-border p-1', {
  variants: {
    size: {
      sm: 'h-9',
      md: 'h-11',
    },
    fullWidth: {
      true: 'flex w-full',
      false: '',
    },
  },
  defaultVariants: { size: 'md', fullWidth: false },
});

const itemVariants = cva(
  [
    'relative flex h-full items-center justify-center gap-2 rounded-full whitespace-nowrap',
    'transition-[color,background-color,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'px-3 text-xs',
        md: 'px-4 text-sm',
      },
      selected: {
        true: 'bg-surface font-semibold text-foreground shadow-sm',
        false: 'font-medium text-foreground-muted hover:text-foreground',
      },
      fullWidth: {
        true: 'flex-1',
        false: '',
      },
    },
    defaultVariants: { size: 'md', selected: false, fullWidth: false },
  },
);

export type SegmentedVariants = VariantProps<typeof trackVariants>;

export interface SegmentedOption<TValue extends string = string> {
  value: TValue;
  label: string;
  /** Rendered before the label — keep it to a 16px icon. */
  icon?: ReactNode;
  /** Rendered after the label — a count badge, typically. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<TValue extends string = string> extends SegmentedVariants {
  options: readonly SegmentedOption<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
}

export function Segmented<TValue extends string = string>({
  options,
  value,
  onValueChange,
  disabled = false,
  size,
  fullWidth,
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<TValue>) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  /** Arrow keys move the selection, skipping disabled options and wrapping. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;

    event.preventDefault();

    const count = options.length;
    const index = options.findIndex((option) => option.value === value);

    for (let offset = 1; offset <= count; offset += 1) {
      const nextIndex = (((index + step * offset) % count) + count) % count;
      const next = options[nextIndex];
      if (next && !next.disabled) {
        onValueChange(next.value);
        const buttons = trackRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons?.[nextIndex]?.focus();
        return;
      }
    }
  }

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={disabled ? undefined : handleKeyDown}
      className={cn(trackVariants({ size, fullWidth }), 'bg-surface-raised', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(itemVariants({ size, selected, fullWidth }))}
          >
            {option.icon}
            {option.label}
            {option.badge}
          </button>
        );
      })}
    </div>
  );
}

Segmented.displayName = 'Segmented';
