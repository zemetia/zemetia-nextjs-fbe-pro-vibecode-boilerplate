import { prisma } from '@/lib/prisma';

import { mapInBatches } from './batch';
import { CURRENCIES } from './data/currencies';

/**
 * Mirrors the ISO 4217 catalog into the currencies table.
 *
 * Unlike the permission seeder this one never prunes: a currency can already be
 * referenced by a country, a price list or a historical transaction, so codes
 * that leave circulation are retired by flipping `isActive` in the UI, not by
 * deleting the row. `isActive` is therefore left untouched on update.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedCurrencies(): Promise<number> {
  await mapInBatches(CURRENCIES, ({ code, numericCode, name, symbol, decimalDigits }) =>
    prisma.currency.upsert({
      where: { code },
      update: { numericCode, name, symbol, decimalDigits },
      create: { code, numericCode, name, symbol, decimalDigits },
    }),
  );

  console.log(`Currencies: ${CURRENCIES.length} in sync`);

  return CURRENCIES.length;
}
