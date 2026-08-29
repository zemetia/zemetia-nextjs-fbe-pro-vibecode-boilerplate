'use client';

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ForwardedRef,
} from 'react';

import { Input, type InputProps } from '@/components/ui/Input';
import { countDigits, formatNumber, parseNumber, toNumberDisplay } from '@/lib/number';

export interface NumberInputProps
  extends Omit<
    InputProps,
    'type' | 'inputMode' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'
  > {
  /** Numeric value. `undefined`/`null` renders an empty field. */
  value?: number | null;
  /** Fires with the parsed number, or `undefined` when the field is emptied. */
  onChange?: (value: number | undefined) => void;
  /** Decimal places allowed. Default 0 — integers only. */
  decimalScale?: number;
  /** Allow a leading `-`. Default false. */
  allowNegative?: boolean;
}

function assignRef(ref: ForwardedRef<HTMLInputElement>, node: HTMLInputElement | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * Restores the caret by counting digits from the end — anchoring from the right
 * keeps it on the correct side of a separator that reformatting moved.
 */
function caretBeforeDigits(element: HTMLInputElement, digitsAfter: number): void {
  let position = element.value.length;
  let seen = 0;

  while (position > 0 && seen < digitsAfter) {
    position -= 1;
    if (/\d/.test(element.value[position] ?? '')) seen += 1;
  }

  element.setSelectionRange(position, position);
}

/**
 * Text field that groups thousands as the user types (100000 → "100.000") and
 * reports a plain `number` upward. Mandatory for every numeric input — see
 * docs/blueprint/LAYOUT/03-form-pages.md#number-inputs.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, decimalScale = 0, allowNegative = false, onBlur, ...props }, ref) => {
    const format = (input: number | null | undefined): string =>
      input === null || input === undefined ? '' : formatNumber(input, { decimalScale });

    const isControlled = value !== undefined;
    const [display, setDisplay] = useState(() => format(value));
    const [lastValue, setLastValue] = useState(value);

    // Adjust-state-during-render: an externally changed `value` (reset, prefill)
    // wins, but a re-render carrying the same value must not clobber a
    // half-typed entry like "1.234,".
    if (isControlled && value !== lastValue) {
      setLastValue(value);
      if (parseNumber(display) !== (value ?? undefined)) setDisplay(format(value));
    }

    const inputRef = useRef<HTMLInputElement | null>(null);
    const caretDigits = useRef<number | null>(null);
    const [revision, setRevision] = useState(0);

    useLayoutEffect(() => {
      const element = inputRef.current;
      const target = caretDigits.current;
      caretDigits.current = null;
      if (element && target !== null) caretBeforeDigits(element, target);
    }, [revision]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
      const raw = event.target.value;
      const caret = event.target.selectionStart ?? raw.length;
      caretDigits.current = countDigits(raw.slice(caret));

      const next = toNumberDisplay(raw, { decimalScale, allowNegative });
      const parsed = parseNumber(next);

      setDisplay(next);
      setLastValue(parsed);
      setRevision((current) => current + 1);
      onChange?.(parsed);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
      const parsed = parseNumber(display);
      setDisplay(format(parsed));
      setLastValue(parsed);
      onBlur?.(event);
    };

    return (
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          assignRef(ref, node);
        }}
        type="text"
        inputMode={decimalScale > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';
