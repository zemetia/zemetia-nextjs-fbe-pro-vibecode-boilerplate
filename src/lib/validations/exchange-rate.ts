import { z } from 'zod';

import { DEFAULT_QUOTE_CURRENCY } from '@/lib/currency';

/** ISO 4217 alpha-3, normalised so `?from=usd` behaves like `?from=USD`. */
const currencyCodeSchema = z
  .string('Mata uang wajib dipilih')
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Kode mata uang tidak valid');

export const exchangeRateQuerySchema = z.object({
  from: currencyCodeSchema,
  to: currencyCodeSchema.default(DEFAULT_QUOTE_CURRENCY),
});

export type ExchangeRateQueryInput = z.infer<typeof exchangeRateQuerySchema>;
