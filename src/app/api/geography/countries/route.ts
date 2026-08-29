import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';
import type { CountryLookupDTO } from '@/types/dtos';

/**
 * Reference lookup for the country combobox — the full active ISO 3166-1 list
 * in one response, so the combobox can filter client-side.
 *
 * Gated by `requireAuth()` rather than a permission: an ISO country list is not
 * sensitive, and every form that needs a country would otherwise break silently
 * for a role that has `suppliers:create` but not a lookup permission.
 */
export async function GET() {
  try {
    await requireAuth();

    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        iso2: true,
        iso3: true,
        name: true,
        dialCode: true,
        region: true,
        currencyCode: true,
      },
    });

    const dto: CountryLookupDTO = {
      data: countries.map((country) => ({
        id: country.id,
        iso2: country.iso2,
        iso3: country.iso3,
        name: country.name,
        dial_code: country.dialCode,
        region: country.region,
        currency_code: country.currencyCode,
      })),
    };

    return NextResponse.json(dto);
  } catch (error) {
    return handleApiError(error);
  }
}
