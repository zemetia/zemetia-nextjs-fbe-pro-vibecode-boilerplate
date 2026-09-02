import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';

export async function nextMetalPurchaseNumber(
  date: Date,
  prefixOrClient?: string | Prisma.TransactionClient,
  _client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const prefix = typeof prefixOrClient === 'string' ? prefixOrClient : 'PO';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000 + 1000));
  return `${prefix}-${year}${month}-${rand}`;
}

export async function nextMetalPurchaseDeliveryNumber(
  date: Date,
  _client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000 + 1000));
  return `TTB-${year}${month}-${rand}`;
}

const MAX_ATTEMPTS = 5;

/** `PO-LM-…`/`KW-LM-…` per `paymentType` — prefiksnya mengikuti dokumentasi skema `purchase.prisma`. */
function purchasePrefix(paymentType: 'PO' | 'DP'): string {
  return paymentType === 'DP' ? 'KW-LM' : 'PO-LM';
}

/** Retry-wrapper untuk endpoint produksi — nomor acak bisa berbenturan, demo.ts tidak perlu ini. */
export async function createWithMetalPurchaseNumber<T>(
  paymentType: 'PO' | 'DP',
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextMetalPurchaseNumber(date, purchasePrefix(paymentType)));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor pembelian gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}

/** `manualNumber` datang dari override operator di form TTB — dipakai apa adanya, bukan digenerate. */
export async function createWithMetalPurchaseDeliveryNumber<T>(
  date: Date,
  create: (number: string) => Promise<T>,
  manualNumber?: string,
): Promise<T> {
  if (manualNumber) {
    try {
      return await create(manualNumber);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new ConflictError(
        `Nomor TTB "${manualNumber}" sudah dipakai. Pakai nomor lain atau kosongkan untuk digenerate otomatis.`,
      );
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextMetalPurchaseDeliveryNumber(date));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor tanda terima gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
