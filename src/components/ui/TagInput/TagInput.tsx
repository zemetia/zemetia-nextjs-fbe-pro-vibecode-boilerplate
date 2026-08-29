'use client';

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Free-text list entered as one line and kept as chips — bar serial numbers on a
 * gold import, for instance. Typing a comma (or Enter, or Tab) commits the chip;
 * pasting `A1, A2, A3` commits all three at once, which is how a serial list
 * arrives from a supplier's invoice.
 *
 * The value is always a `string[]`; the half-typed text lives inside the
 * component, and is committed on blur so a value the user typed but never
 * separated is not silently lost on submit.
 */

export interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Refuse further entries past this many chips. */
  maxTags?: number;
  /** Trim + case-insensitive duplicate check. Default true. */
  unique?: boolean;
  className?: string;
  id?: string;
}

const SEPARATOR = /[,\n\r\t;]+/;

export function TagInput({
  value,
  onChange,
  label,
  hint,
  error,
  placeholder = 'Ketik lalu pisahkan dengan koma',
  required = false,
  disabled = false,
  maxTags,
  unique = true,
  className,
  id,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const isFull = maxTags !== undefined && value.length >= maxTags;

  function commit(raw: string): void {
    const incoming = raw
      .split(SEPARATOR)
      .map((part) => part.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;

    const next = [...value];
    const seen = new Set(next.map((tag) => tag.toLowerCase()));

    for (const tag of incoming) {
      if (maxTags !== undefined && next.length >= maxTags) break;
      if (unique && seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      next.push(tag);
    }

    if (next.length !== value.length) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === ',' || event.key === 'Enter') {
      // Enter must not submit the surrounding form while a chip is pending.
      // Tab is deliberately not intercepted — it commits via blur and still
      // moves focus, so the field never traps the keyboard.
      event.preventDefault();
      commit(draft);
      setDraft('');
      return;
    }

    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData('text');
    if (!SEPARATOR.test(pasted)) return;

    event.preventDefault();
    commit(`${draft}${pasted}`);
    setDraft('');
  }

  function remove(index: number): void {
    onChange(value.filter((_, position) => position !== index));
  }

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Clicking the empty part of the box focuses the field — the chips and the
          text input keep their own semantics, so the box itself stays presentational. */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus();
        }}
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5 shadow-xs',
          'transition-[color,box-shadow,border-color] duration-150',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25',
          error ? 'border-destructive focus-within:border-destructive focus-within:ring-destructive/25' : 'border-input hover:border-border-strong',
          disabled && 'cursor-not-allowed bg-surface-raised opacity-60',
        )}
      >
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary-subtle py-0.5 pr-1 pl-2 font-mono text-xs text-primary"
          >
            {tag}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(index)}
              aria-label={`Hapus ${tag}`}
              className="rounded-sm p-0.5 text-primary/70 transition-colors hover:bg-primary-muted hover:text-primary disabled:pointer-events-none"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          autoComplete="off"
          value={draft}
          disabled={disabled || isFull}
          placeholder={value.length === 0 ? placeholder : isFull ? '' : '…'}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            commit(draft);
            setDraft('');
          }}
          className={cn(
            'min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none',
            'placeholder:text-foreground-subtle disabled:cursor-not-allowed',
          )}
        />
      </div>

      {error && (
        <p id={`${fieldId}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${fieldId}-hint`} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

TagInput.displayName = 'TagInput';
