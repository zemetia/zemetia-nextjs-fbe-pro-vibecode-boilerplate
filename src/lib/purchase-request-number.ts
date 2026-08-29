import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';

/**
 * `PR-202608-0001`, direset tiap bulan — skema yang sama dipakai jurnal, PO,
 * order penjualan, SPK, dan voucher. Diturunkan dari nomor tertinggi di
 * periodenya, bukan dari sequence, jadi dua petugas yang menyimpan bersamaan
 * bisa memilih nomor yang sama; pemanggilnya menyerap itu dengan mengulang saat
 * unique violation alih-alih mengunci tabel.
 *
 * Periodenya diambil dari **tanggal permintaan**, bukan dari hari ini: PR yang
 * dimundurkan ke bulan lalu masuk ke deret nomor bulan lalu.
 */

const PREFIX = 'PR';
const SEQUENCE_DIGITS = 4;
const MAX_ATTEMPTS = 5;

function period(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function nextPurchaseRequestNumber(
  date: Date,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const prefix = `${PREFIX}-${period(date)}-`;

  const latest = await client.purchaseRequest.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const sequence = latest ? Number(latest.number.split('-').at(-1)) + 1 : 1;

  return `${prefix}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export async function createWithPurchaseRequestNumber<T>(
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextPurchaseRequestNumber(date));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor permintaan gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
