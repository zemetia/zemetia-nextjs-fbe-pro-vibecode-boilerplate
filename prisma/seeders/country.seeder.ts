import { prisma } from '@/lib/prisma';

import { mapInBatches } from './batch';
import { COUNTRIES } from './data/countries';

/**
 * Mirrors the ISO 3166-1 catalog into the countries table, keyed on `iso2`.
 *
 * Runs after `seedCurrencies` — every `currencyCode` here is a foreign key into
 * the currencies table. Like currencies it never prunes and never touches
 * `isActive`: a country the company does not trade with is switched off in the
 * UI, and one already referenced by a shipment must stay.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedCountries(): Promise<number> {
  await mapInBatches(
    COUNTRIES,
    ({ iso2, iso3, numericCode, name, nameEn, dialCode, region, currencyCode }) =>
      prisma.country.upsert({
        where: { iso2 },
        update: { iso3, numericCode, name, nameEn, dialCode, region, currencyCode },
        create: { iso2, iso3, numericCode, name, nameEn, dialCode, region, currencyCode },
      }),
  );

  console.log(`Countries: ${COUNTRIES.length} in sync`);

  return COUNTRIES.length;
}
