import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';

/**
 * `SPK-202608-0001`, restarting each month — the scheme the journal, purchase
 * orders, sales orders and vouchers all share. Derived from the highest number
 * in the period rather than from a sequence object, so two clerks saving at once
 * can pick the same one; the caller absorbs that by retrying the unique
 * violation instead of locking the table.
 *
 * The period comes from the *order date*, not from today: an order backdated to
 * last month belongs in last month's run of numbers.
 */

const PREFIX = 'SPK';
const SEQUENCE_DIGITS = 4;
const MAX_ATTEMPTS = 5;

function period(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function nextProductionOrderNumber(
  date: Date,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const prefix = `${PREFIX}-${period(date)}-`;

  const latest = await client.productionOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const sequence = latest ? Number(latest.number.split('-').at(-1)) + 1 : 1;

  return `${prefix}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export async function createWithProductionOrderNumber<T>(
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextProductionOrderNumber(date));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor SPK gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
