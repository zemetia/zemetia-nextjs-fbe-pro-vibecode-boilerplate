import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createJournalEntryWithin } from '@/lib/journal';
import { buildReceiptJournalLines, buildShipmentJournalLines, PAYABLE_ACCOUNT_CODE } from '@/lib/metal-purchase';

/**
 * Akun yang dijurnal saat barang diterima adalah **data**, bukan kode di sini —
 * `Product.inventoryAccountId`/`transitAccountId` (`prisma/schema/product.prisma`).
 * Barang berikutnya (granul perak, platina) berarti satu baris master, bukan
 * satu cabang di sebuah `switch`. File ini hanya menagih baris itu memang
 * terisi sebelum dipakai — kegagalannya menyebut barangnya, bukan kode akun,
 * supaya yang membaca pesan tahu master mana yang harus dilengkapi.
 */

export interface ProductAccounts {
  productName: string;
  inventoryAccountId: string;
  transitAccountId: string | null;
}

export async function requireProductAccounts(
  productIds: readonly string[],
  client: Prisma.TransactionClient = prisma,
): Promise<Map<string, ProductAccounts>> {
  const unique = [...new Set(productIds)];
  const products = await client.product.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, inventoryAccountId: true, transitAccountId: true },
  });

  const byId = new Map<string, ProductAccounts>();
  for (const product of products) {
    if (!product.inventoryAccountId) {
      throw new ValidationError(
        `Barang ${product.name} belum punya akun persediaan di master barang — lengkapi dulu sebelum barang ini bisa diterima.`,
      );
    }

    byId.set(product.id, {
      productName: product.name,
      inventoryAccountId: product.inventoryAccountId,
      transitAccountId: product.transitAccountId,
    });
  }

  return byId;
}

/** Sama, tapi juga menagih akun transit — dipakai jalur kiriman impor (`IN_TRANSIT`). */
export async function requireProductAccountsWithTransit(
  productIds: readonly string[],
  client: Prisma.TransactionClient = prisma,
): Promise<Map<string, ProductAccounts & { transitAccountId: string }>> {
  const byId = await requireProductAccounts(productIds, client);
  const result = new Map<string, ProductAccounts & { transitAccountId: string }>();

  for (const [id, accounts] of byId) {
    if (!accounts.transitAccountId) {
      throw new ValidationError(
        `Barang ${accounts.productName} belum punya akun transit di master barang — lengkapi dulu sebelum kiriman ini bisa diberangkatkan.`,
      );
    }
    result.set(id, { ...accounts, transitAccountId: accounts.transitAccountId });
  }

  return result;
}

async function findPayableAccountId(tx: Prisma.TransactionClient): Promise<string> {
  const account = await tx.ledgerAccount.findFirst({
    where: { code: PAYABLE_ACCOUNT_CODE },
    select: { id: true },
  });

  if (!account) {
    throw new NotFoundError('Akun hutang usaha 2110 tidak ditemukan di COA aktif.');
  }

  return account.id;
}

function deliveryValueForLine(
  line: {
    weightGram: Prisma.Decimal | string | number;
    fineWeightGram: Prisma.Decimal | string | number;
    purchaseItem: {
      weightGram: Prisma.Decimal | string | number;
      fineWeightGram: Prisma.Decimal | string | number;
      amount: Prisma.Decimal | string | number;
    };
  },
): number {
  const weightGram = Number(line.weightGram);
  const fineWeightGram = Number(line.fineWeightGram);
  const purchaseWeight = Number(line.purchaseItem.weightGram || 0);
  const purchaseFineWeight = Number(line.purchaseItem.fineWeightGram || 0);
  const purchaseAmount = Number(line.purchaseItem.amount || 0);

  if (purchaseAmount <= 0) return 0;

  if (purchaseFineWeight > 0 && fineWeightGram > 0) {
    return (purchaseAmount * fineWeightGram) / purchaseFineWeight;
  }

  if (purchaseWeight > 0 && weightGram > 0) {
    return (purchaseAmount * weightGram) / purchaseWeight;
  }

  return purchaseAmount;
}

export async function findDeliveryJournals(
  deliveryId: string,
): Promise<Array<{ id: string; number: string; status: string }>> {
  return prisma.journalEntry.findMany({
    where: { deliveryId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, number: true, status: true },
  });
}

export async function postShipmentJournal(
  deliveryId: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const delivery = await tx.goodsReceipt.findUnique({
    where: { id: deliveryId },
    include: {
      lines: {
        include: {
          purchaseItem: {
            select: {
              amount: true,
              weightGram: true,
              fineWeightGram: true,
              productId: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');

  const accountsByProduct = await requireProductAccountsWithTransit(
    delivery.lines.map((line) => line.purchaseItem.productId),
    tx,
  );
  const payableAccountId = await findPayableAccountId(tx);

  const rows = delivery.lines.map((line) => {
    const productAccounts = accountsByProduct.get(line.purchaseItem.productId);
    if (!productAccounts) {
      throw new ValidationError('Barang pada tanda terima ini tidak memiliki akun transit yang valid.');
    }

    return {
      transitAccountId: productAccounts.transitAccountId,
      amount: deliveryValueForLine(line),
      memo: `Pengiriman ${delivery.number}`,
    };
  });

  await createJournalEntryWithin(
    {
      date: delivery.date,
      description: `Tanda terima ${delivery.number} — barang berangkat ke supplier / transit`,
      source: 'INVENTORY',
      referenceType: 'METAL_PURCHASE_DELIVERY',
      referenceId: deliveryId,
      deliveryId,
      lines: buildShipmentJournalLines(rows, payableAccountId),
      post: true,
    },
    actorId,
    tx,
  );
}

export async function postReceiptJournal(
  deliveryId: string,
  fromInTransit: boolean,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const delivery = await tx.goodsReceipt.findUnique({
    where: { id: deliveryId },
    include: {
      lines: {
        include: {
          purchaseItem: {
            select: {
              amount: true,
              weightGram: true,
              fineWeightGram: true,
              productId: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');

  const accountsByProduct = await requireProductAccounts(
    delivery.lines.map((line) => line.purchaseItem.productId),
    tx,
  );
  const payableAccountId = await findPayableAccountId(tx);

  const rows = delivery.lines.map((line) => {
    const productAccounts = accountsByProduct.get(line.purchaseItem.productId);
    if (!productAccounts) {
      throw new ValidationError('Barang pada tanda terima ini tidak memiliki akun persediaan yang valid.');
    }

    return {
      inventoryAccountId: productAccounts.inventoryAccountId,
      contraAccountId: fromInTransit ? productAccounts.transitAccountId ?? payableAccountId : payableAccountId,
      amount: deliveryValueForLine(line),
      memo: `Penerimaan ${delivery.number}`,
    };
  });

  await createJournalEntryWithin(
    {
      date: delivery.date,
      description: `Tanda terima ${delivery.number} — barang diterima ke gudang`,
      source: 'INVENTORY',
      referenceType: 'METAL_PURCHASE_DELIVERY',
      referenceId: deliveryId,
      deliveryId,
      lines: buildReceiptJournalLines(rows),
      post: true,
    },
    actorId,
    tx,
  );
}

export async function voidDeliveryJournals(
  deliveryId: string,
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.journalEntry.updateMany({
    where: {
      deliveryId,
      status: { not: 'VOID' },
    },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidedById: actorId,
      voidReason: reason,
    },
  });
}
