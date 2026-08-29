import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { parseListQuery } from '@/lib/pagination';
import { getExchangeRate } from '@/lib/exchange-rate';
import { exchangeRateQuerySchema } from '@/lib/validations';
import type { ExchangeRateDTO } from '@/types/dtos';

/**
 * Live FX quote for one pair — `/api/exchange-rates?from=USD&to=IDR`.
 *
 * A reference lookup like the country/currency routes, so it is gated on being
 * signed in rather than on its own permission. Both codes are checked against
 * our currency table first: that keeps a typo a 404 with a readable message
 * instead of an upstream failure, and hands us the symbol/precision the client
 * needs to format the result.
 */
export async function GET(request: Request) {
  try {
    await requireAuth();

    const { from, to } = parseListQuery(request, exchangeRateQuerySchema);

    const select = { code: true, symbol: true, decimalDigits: true } as const;
    const [base, quote] = await Promise.all([
      prisma.currency.findUnique({ where: { code: from }, select }),
      prisma.currency.findUnique({ where: { code: to }, select }),
    ]);
    if (!base) throw new NotFoundError('Mata uang asal tidak dikenali.');
    if (!quote) throw new NotFoundError('Mata uang tujuan tidak dikenali.');

    const result = await getExchangeRate(base.code, quote.code);

    const dto: ExchangeRateDTO = {
      base: base.code,
      quote: quote.code,
      rate: result.rate,
      symbol: quote.symbol,
      decimal_digits: quote.decimalDigits,
      as_of: result.asOf.toISOString(),
      // Sumbernya ikut dikirim, bukan dipatok client: mana yang menjawab
      // (BCA atau Yahoo) diputuskan per pasangan di server.
      source: result.source,
    };

    return NextResponse.json(dto);
  } catch (error) {
    return handleApiError(error);
  }
}
