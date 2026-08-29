// Currency conversion maths and multi-currency display. Pure and isomorphic —
// fetching the rate itself lives in `@/lib/exchange-rate` (server only, it pulls
// in the Yahoo Finance client).

import { formatNumber } from '@/lib/number';

/** Base currency every rate is quoted against unless the caller says otherwise. */
export const DEFAULT_QUOTE_CURRENCY = 'IDR';

/** Yahoo Finance names an FX pair `USDIDR=X` — the same symbol `yfinance` uses. */
export function fxSymbol(base: string, quote: string): string {
  return `${base}${quote}=X`;
}

/**
 * Converts `amount` from the base currency into the quote currency, rounded to
 * the quote currency's own precision — JPY carries 0 decimals and the Gulf
 * dinars carry 3, so a fixed 2 would be off by a factor of ten either way.
 *
 * Display-side maths on `number`. Anything that has to reconcile (journal
 * lines, invoices) must do its arithmetic on the stored `Decimal` instead.
 */
export function convertAmount(amount: number, rate: number, decimalDigits = 2): number {
  const factor = 10 ** decimalDigits;
  return Math.round(amount * rate * factor) / factor;
}

export interface MoneyCurrency {
  code: string;
  symbol?: string;
  decimalDigits?: number;
}

/**
 * 1234.5 in USD → "$ 1.234,50". Falls back to the ISO code when the currency has
 * no symbol, and always formats with the Indonesian separators (`@/lib/number`).
 */
export function formatMoney(value: number, currency: MoneyCurrency): string {
  const { code, symbol, decimalDigits = 2 } = currency;
  const formatted = formatNumber(value, { decimalScale: decimalDigits, fixed: true });
  return formatted === '' ? '' : `${symbol || code} ${formatted}`;
}

/** "1 USD = Rp 16.250,00" — the one-line summary shown next to a rate. */
export function rateLabel(base: string, rate: number, quote: MoneyCurrency): string {
  return `1 ${base} = ${formatMoney(rate, quote)}`;
}
