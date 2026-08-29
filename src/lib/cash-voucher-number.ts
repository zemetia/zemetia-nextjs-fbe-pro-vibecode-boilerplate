import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { voucherNumberPrefix } from '@/lib/cash-voucher';
import type { VoucherDirection, VoucherFund } from '@/types/value-objects';

/**
 * `BKK-202608-0042`, restarting each month **per kind**, derived from the highest
 * number already in that period — the same scheme the journal, the purchase
 * orders and the sales orders use. There is no sequence object behind it, so two
 * clerks saving at once can pick the same number; `createWithVoucherNumber`
 * absorbs that by retrying on the unique violation instead of locking the table.
 *
 * Each kind runs its own sequence because that is how the paper is filed: a BKK
 * book and a BBK book are two books, and a clerk asked for "BKK nomor 42" is not
 * asking for the forty-second voucher of any type.
 *
 * The period comes from the *voucher date*, not from today: a document backdated
 * to last month belongs in last month's run of numbers.
 */

const SEQUENCE_DIGITS = 4;
const MAX_ATTEMPTS = 5;

function period(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function nextCashVoucherNumber(
  fund: VoucherFund,
  direction: VoucherDirection,
  date: Date,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const prefix = `${voucherNumberPrefix(fund, direction)}-${period(date)}-`;

  const latest = await client.cashVoucher.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const sequence = latest ? Number(latest.number.split('-').at(-1)) + 1 : 1;

  return `${prefix}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export async function createWithVoucherNumber<T>(
  fund: VoucherFund,
  direction: VoucherDirection,
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextCashVoucherNumber(fund, direction, date));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor voucher gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
