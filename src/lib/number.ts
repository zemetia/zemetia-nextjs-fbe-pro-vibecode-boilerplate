// Indonesian number formatting — thousands separator is `.`, decimal separator
// is `,` (100000 → "100.000"). Every number the user sees or types goes through
// here. See docs/blueprint/LAYOUT/03-form-pages.md#number-inputs.

export const GROUP_SEPARATOR = '.';
export const DECIMAL_SEPARATOR = ',';

/** Inserts `.` every three digits into a bare digit string. */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

export interface FormatNumberOptions {
  /** Maximum decimal places kept. Default 0 — integers only. */
  decimalScale?: number;
  /** Pad the decimals to `decimalScale` digits (money-style). Default false. */
  fixed?: boolean;
}

/** 1234567.5 → "1.234.567" (decimalScale 0) / "1.234.567,5" (decimalScale 2). */
export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
  const { decimalScale = 0, fixed = false } = options;

  if (!Number.isFinite(value)) return '';

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fixed ? decimalScale : 0,
    maximumFractionDigits: decimalScale,
  }).format(value);
}

/** 1234567 → "Rp 1.234.567". */
export function formatCurrency(value: number, options: FormatNumberOptions = {}): string {
  const formatted = formatNumber(value, options);
  return formatted === '' ? '' : `Rp ${formatted}`;
}

/**
 * "Rp 1.234.567,5" → 1234567.5. Returns `undefined` when the input holds no
 * digits at all, so an empty field stays empty instead of becoming 0.
 */
export function parseNumber(input: string): number | undefined {
  const negative = input.trimStart().startsWith('-');
  const [integer = '', ...rest] = input.replace(/[^\d,]/g, '').split(DECIMAL_SEPARATOR);
  const decimals = rest.join('');

  if (integer === '' && decimals === '') return undefined;

  const parsed = Number(`${integer || '0'}.${decimals || '0'}`);
  if (!Number.isFinite(parsed)) return undefined;

  return negative ? -parsed : parsed;
}

export interface NumberDisplayOptions {
  decimalScale?: number;
  allowNegative?: boolean;
}

/**
 * Normalises whatever sits in a number field into its display form, keeping a
 * half-typed decimal ("1.234," ) intact so typing never fights the formatter.
 * `.` is always a group separator here — the decimal separator is `,` only.
 */
export function toNumberDisplay(raw: string, options: NumberDisplayOptions = {}): string {
  const { decimalScale = 0, allowNegative = false } = options;

  const negative = allowNegative && raw.trimStart().startsWith('-');
  const cleaned = raw.replace(/[^\d,]/g, '');
  const [rawInteger = '', ...rest] = cleaned.split(DECIMAL_SEPARATOR);

  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  const hasDecimal = decimalScale > 0 && rest.length > 0;
  const decimals = hasDecimal ? rest.join('').slice(0, decimalScale) : '';

  if (integer === '' && !hasDecimal) return negative ? '-' : '';

  const body = groupDigits(integer || '0') + (hasDecimal ? DECIMAL_SEPARATOR + decimals : '');
  return negative ? `-${body}` : body;
}

/** How many digits sit in `text` — used to keep the caret in place while typing. */
export function countDigits(text: string): number {
  return (text.match(/\d/g) ?? []).length;
}

/**
 * Rounds half-up at `digits`, matching a stored column's own scale.
 *
 * Lives here rather than in one document's module because every money
 * computation in the ERP needs the same rounding — a second implementation is
 * how two screens end up disagreeing about the same total by one cent.
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
