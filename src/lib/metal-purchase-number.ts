import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
