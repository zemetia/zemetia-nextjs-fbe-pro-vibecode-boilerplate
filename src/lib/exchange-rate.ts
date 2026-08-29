import YahooFinance from 'yahoo-finance2';

import { captureError } from '@/lib/sentry';
import { fxSymbol, DEFAULT_QUOTE_CURRENCY } from '@/lib/currency';
import { AppError } from '@/lib/errors';
import { BCA_RATE_SOURCE, getBcaRates } from '@/lib/bca-rate';

/**
 * Live FX quotes, dengan **dua sumber berurutan**.
 *
 * Pilihan pertama untuk pasangan `→ IDR` adalah **kurs beli e-Rate Bank BCA**
 * (`@/lib/bca-rate`): itu kurs bank yang benar-benar dipakai membayar, jadi
 * angka yang muncul di form pembelian impor adalah angka yang sama dengan yang
 * akan tertera di rekening. Yahoo Finance (`yahoo-finance2`, padanan JavaScript
 * dari `yfinance`, simbol `USDIDR=X` yang sama) tetap ada sebagai cadangan: ia
 * mengutip mid-market dan mengenal jauh lebih banyak pasangan daripada 18 mata
 * uang yang diterbitkan BCA.
 *
 * Keduanya tidak resmi: BCA dibaca dari halaman publiknya dan endpoint Yahoo
 * tidak punya SLA. Perlakukan setiap kurs di sini sebagai **saran tampilan**.
 * Apa pun yang harus lolos audit (jurnal, invoice supplier) wajib **menyimpan
 * kursnya sendiri** saat dokumennya dibuat, bukan membacanya ulang dari sini.
 *
 * Server-only — never import this from a `'use client'` module.
 */

/** Yahoo is unreachable or answering with garbage — distinct from a bad pair. */
export class ExchangeRateUnavailableError extends AppError {
  readonly status = 503;
}

const RATE_UNAVAILABLE_MESSAGE =
  'Layanan kurs sedang tidak dapat dihubungi. Silakan coba lagi beberapa saat lagi.';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  versionCheck: false,
});

export const YAHOO_RATE_SOURCE = 'Yahoo Finance';

/**
 * Quotes move by the second but the UI does not need that: a short in-process
 * cache keeps a form that re-renders (or three users on the same screen) from
 * hammering an endpoint that rate-limits by IP. It lives in module memory, so
 * every server instance warms its own — that is fine for a cache with no
 * correctness role.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ExchangeRateQuote {
  base: string;
  quote: string;
  rate: number;
  asOf: Date;
  /** Sumber angkanya, apa adanya untuk ditampilkan di sebelah kursnya. */
  source: string;
}

const cache = new Map<string, { value: ExchangeRateQuote; expiresAt: number }>();

export async function getExchangeRate(base: string, quote: string): Promise<ExchangeRateQuote> {
  if (base === quote) {
    return { base, quote, rate: 1, asOf: new Date(), source: BCA_RATE_SOURCE };
  }

  // BCA hanya menerbitkan kurs terhadap rupiah, dan hanya 18 mata uang; di luar
  // itu Yahoo yang menjawab. Cache-nya sendiri ada di `@/lib/bca-rate`, jadi
  // tidak perlu ikut cache di bawah.
  if (quote === DEFAULT_QUOTE_CURRENCY) {
    const table = await getBcaRates();
    const row = table?.rates.get(base);
    if (table && row) {
      return { base, quote, rate: row.eRateBuy, asOf: table.asOf, source: BCA_RATE_SOURCE };
    }
  }

  const symbol = fxSymbol(base, quote);
  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let rate: number | undefined;
  let asOf: Date | undefined;

  try {
    const result = await yahooFinance.quote(symbol);
    rate = result?.regularMarketPrice;
    asOf = result?.regularMarketTime;
  } catch (error) {
    // Covers both an unreachable Yahoo and a pair it does not list. The caller
    // has already verified both codes against our own currency table, so a
    // failure here is the upstream's, not the user's input.
    captureError(error, { symbol });
    throw new ExchangeRateUnavailableError(RATE_UNAVAILABLE_MESSAGE);
  }

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new ExchangeRateUnavailableError(RATE_UNAVAILABLE_MESSAGE);
  }

  const value: ExchangeRateQuote = {
    base,
    quote,
    rate,
    asOf: asOf ?? new Date(),
    source: YAHOO_RATE_SOURCE,
  };
  cache.set(symbol, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
