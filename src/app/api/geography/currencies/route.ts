import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';
import type { CurrencyLookupDTO } from '@/types/dtos';

/** Reference lookup for the currency combobox — see the countries route. */
export async function GET() {
  try {
    await requireAuth();

    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, symbol: true, decimalDigits: true },
    });

    const dto: CurrencyLookupDTO = {
      data: currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimal_digits: currency.decimalDigits,
      })),
    };

    return NextResponse.json(dto);
  } catch (error) {
    return handleApiError(error);
  }
}
