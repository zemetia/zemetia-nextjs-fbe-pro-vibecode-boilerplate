import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';

function randomSuffix(): string {
  return String(Math.floor(Math.random() * 9000 + 1000));
}

export async function nextSalesOrderNumber(
  date: Date,
  type: 'LOCAL' | 'EXPORT',
  paymentType: 'PO' | 'DP',
  _client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prefix =
    paymentType === 'DP' ? 'KW' : 'SO';
  const region = type === 'LOCAL' ? 'LOKAL' : 'EXP';
  return `${prefix}-${region}-${year}${month}-${randomSuffix()}`;
}

export async function nextSalesDeliveryNumber(
  date: Date,
  type: 'LOCAL' | 'EXPORT',
  _client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prefix = type === 'LOCAL' ? 'SJ-LOKAL' : 'DO-EXP';
  return `${prefix}-${year}${month}-${randomSuffix()}`;
}

export async function nextSalesInvoiceNumber(
  date: Date,
  type: 'LOCAL' | 'EXPORT',
  _client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prefix = type === 'LOCAL' ? 'INV-LOKAL' : 'INV-EXP';
  return `${prefix}-${year}${month}-${randomSuffix()}`;
}

const MAX_ATTEMPTS = 5;

/** Retry-wrapper untuk endpoint produksi — nomor acak bisa berbenturan. */
export async function createWithSalesOrderNumber<T>(
  type: 'LOCAL' | 'EXPORT',
  paymentType: 'PO' | 'DP',
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextSalesOrderNumber(date, type, paymentType));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor sales order gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}

export async function createWithSalesDeliveryNumber<T>(
  type: 'LOCAL' | 'EXPORT',
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextSalesDeliveryNumber(date, type));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor surat jalan gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}

export async function createWithSalesInvoiceNumber<T>(
  type: 'LOCAL' | 'EXPORT',
  date: Date,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextSalesInvoiceNumber(date, type));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor faktur gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
