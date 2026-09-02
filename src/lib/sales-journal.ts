import type { Prisma } from '@prisma/client';

import { NotFoundError, ValidationError } from '@/lib/errors';
import { createJournalEntryWithin } from '@/lib/journal';
import { createMetalMovement } from '@/lib/metal-movement-write';
import {
  COGS_EXPORT_ACCOUNT_CODE,
  COGS_LOCAL_ACCOUNT_CODE,
  RECEIVABLE_EXPORT_ACCOUNT_CODE,
  RECEIVABLE_LOCAL_ACCOUNT_CODE,
  SALES_DOWN_PAYMENT_ACCOUNT_CODE,
  SALES_REVENUE_EXPORT_ACCOUNT_CODE,
  SALES_REVENUE_LOCAL_ACCOUNT_CODE,
} from '@/lib/sales';

/**
 * Jurnal penjualan — sisi cermin dari `metal-purchase-journal.ts`.
 *
 * Akun yang dijurnal adalah **data**, bukan kode di sini: akun persediaan yang
 * dikredit saat barang keluar diambil dari `Product.inventoryAccountId`, dan
 * akun piutang/pendapatan/HPP dipilih dari konstanta kode di `src/lib/sales.ts`
 * (semuanya bertipe `detail` di COA aktif Prisma — `4120`/`5110` legacy adalah
 * header dan tidak boleh dijurnal, lihat LEARN 2026-08-28).
 */

async function findAccountIdByCode(
  tx: Prisma.TransactionClient,
  code: string,
  label: string,
): Promise<string> {
  const account = await tx.ledgerAccount.findFirst({
    where: { code },
    select: { id: true },
  });

  if (!account) {
    throw new NotFoundError(`Akun ${label} (${code}) tidak ditemukan di COA aktif.`);
  }

  return account.id;
}

/** Harga pokok per gram dari sumber perolehan lot (PO pembelian asal). */
async function unitCostGramForProduct(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<number> {
  const lot = await tx.metalLot.findFirst({
    where: { productId, sourcePurchaseId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      sourcePurchase: {
        include: {
          items: {
            where: { productId },
            select: { amount: true, weightGram: true },
          },
        },
      },
    },
  });

  if (!lot?.sourcePurchase) return 0;

  const items = lot.sourcePurchase.items;
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalWeight = items.reduce((sum, item) => sum + Number(item.weightGram), 0);
  if (totalWeight <= 0) return 0;

  return totalAmount / totalWeight;
}

/**
 * Konfirmasi surat jalan → mutasi `ISSUE` + jurnal HPP dalam satu transaksi.
 * Barang keluar dari akun persediaan produk (`Product.inventoryAccountId`)
 * ke akun HPP (5114 lokal / 5115 ekspor). Nilai HPP = berat keluar × harga
 * pokok per gram dari perolehan lot.
 */
export async function postDeliveryIssueAndCogs(
  deliveryId: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const delivery = await tx.salesDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: { select: { type: true, number: true } },
      lines: {
        include: {
          orderItem: {
            include: { product: { select: { id: true, name: true, inventoryAccountId: true } } },
          },
        },
      },
    },
  });

  if (!delivery) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');

  const isExport = delivery.order.type === 'EXPORT';
  const cogsAccountId = await findAccountIdByCode(
    tx,
    isExport ? COGS_EXPORT_ACCOUNT_CODE : COGS_LOCAL_ACCOUNT_CODE,
    isExport ? 'HPP Ekspor' : 'HPP Lokal',
  );

  // Mutasi fisik: lot keluar dari lokasinya.
  const movement = await createMetalMovement(tx, {
    type: 'ISSUE',
    date: delivery.date,
    referenceType: 'SALES_DELIVERY',
    referenceId: deliveryId,
    notes: `Surat jalan ${delivery.number} — barang keluar ke customer`,
    createdById: actorId,
    lines: delivery.lines.map((line) => ({
      direction: 'OUT',
      lotId: line.lotId,
      locationId: line.locationId,
      pieceCount: line.pieceCount,
      grossWeightGram: Number(line.grossWeightGram),
      purityPercent: Number(line.purityPercent),
      fineWeightGram: Number(line.fineWeightGram),
    })),
  });

  await tx.salesDelivery.update({
    where: { id: deliveryId },
    data: { movementId: movement.id },
  });

  // Jurnal HPP: Debet HPP / Kredit akun persediaan produk, per baris.
  const rows: { inventoryAccountId: string; amount: number; memo: string }[] = [];
  for (const line of delivery.lines) {
    const product = line.orderItem.product;
    if (!product.inventoryAccountId) {
      throw new ValidationError(
        `Barang ${product.name} belum punya akun persediaan di master barang — lengkapi dulu sebelum barang ini bisa dikirim.`,
      );
    }

    const unitCost = await unitCostGramForProduct(tx, product.id);
    const amount = Math.round(Number(line.grossWeightGram) * unitCost * 100) / 100;
    if (amount > 0) {
      rows.push({
        inventoryAccountId: product.inventoryAccountId,
        amount,
        memo: `Pengeluaran ${delivery.number} — ${product.name}`,
      });
    }
  }

  if (rows.length > 0) {
    const totalCogs = rows.reduce((sum, row) => sum + row.amount, 0);
    const firstRow = rows[0];
    if (!firstRow) return;
    const inventoryAccountId = firstRow.inventoryAccountId;
    await createJournalEntryWithin(
      {
        date: delivery.date,
        description: `Surat jalan ${delivery.number} — pengakuan HPP barang keluar`,
        source: 'SALES',
        referenceType: 'SALES_DELIVERY',
        referenceId: deliveryId,
        salesDeliveryId: deliveryId,
        post: true,
        lines: [
          ...rows.map((row) => ({ accountId: cogsAccountId, debit: row.amount, memo: row.memo })),
          { accountId: inventoryAccountId, credit: totalCogs, memo: null },
        ],
      },
      actorId,
      tx,
    );
  }
}

/**
 * Faktur diposting → jurnal piutang/pendapatan.
 *
 * Lokal tunai: Debet Bank BCA (1121) / Kredit Pendapatan (4111).
 * Lokal tempo: Debet Piutang (1130) / Kredit Pendapatan (4111).
 * DP: Debet Piutang (sisa) + Debet Uang Muka (2150) / Kredit Pendapatan.
 * Ekspor: Debet Piutang Ekspor (1132) / Kredit Pendapatan Ekspor (4116).
 */
export async function postInvoiceReceivableJournal(
  invoiceId: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const invoice = await tx.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: { order: { select: { type: true, number: true } } },
  });

  if (!invoice) throw new NotFoundError('Faktur yang dipilih tidak ditemukan.');

  const isExport = invoice.order.type === 'EXPORT';
  const revenueAccountId = await findAccountIdByCode(
    tx,
    isExport ? SALES_REVENUE_EXPORT_ACCOUNT_CODE : SALES_REVENUE_LOCAL_ACCOUNT_CODE,
    isExport ? 'Pendapatan Ekspor' : 'Pendapatan Lokal',
  );

  const receivableAccountId = await findAccountIdByCode(
    tx,
    isExport ? RECEIVABLE_EXPORT_ACCOUNT_CODE : RECEIVABLE_LOCAL_ACCOUNT_CODE,
    isExport ? 'Piutang Ekspor' : 'Piutang Lokal',
  );

  const total = Number(invoice.totalAmount);
  const dpAmount = Number(invoice.dpAmount);
  const remaining = Math.round((total - dpAmount) * 100) / 100;

  const lines: { accountId: string; debit?: number; credit?: number; memo?: string | null }[] = [];

  if (dpAmount > 0) {
    // DP sudah diterima saat order dibuat — tutup uang muka (2150) dan tagih sisanya.
    const dpAccountId = await findAccountIdByCode(tx, SALES_DOWN_PAYMENT_ACCOUNT_CODE, 'Uang Muka Penjualan');
    lines.push({ accountId: dpAccountId, debit: dpAmount, memo: 'Pelunasan uang muka penjualan' });
  }

  if (remaining > 0) {
    lines.push({
      accountId: receivableAccountId,
      debit: remaining,
      memo: invoice.paymentMode === 'CASH' ? 'Pembayaran tunai' : 'Piutang penjualan',
    });
  }

  lines.push({ accountId: revenueAccountId, credit: total, memo: null });

  await createJournalEntryWithin(
    {
      date: invoice.date,
      description: `Faktur ${invoice.number} — penjualan ${isExport ? 'ekspor PPN 0%' : 'lokal'}`,
      source: 'SALES',
      referenceType: 'SALES_INVOICE',
      referenceId: invoiceId,
      salesInvoiceId: invoiceId,
      post: true,
      lines,
    },
    actorId,
    tx,
  );
}

export async function voidSalesJournals(
  target: { deliveryId?: string; invoiceId?: string; orderId?: string },
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const where = {
    ...(target.deliveryId ? { salesDeliveryId: target.deliveryId } : {}),
    ...(target.invoiceId ? { salesInvoiceId: target.invoiceId } : {}),
    ...(target.orderId ? { salesOrderId: target.orderId } : {}),
  };

  await tx.journalEntry.updateMany({
    where: {
      ...where,
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
