import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { toUtcDateOnly } from '@/lib/date';
import { METAL_PURCHASE_DELIVERY_STATUS_LABELS } from '@/lib/metal-purchase';
import type { CreateMetalPurchaseDeliveryInput } from '@/lib/validations';

/**
 * PO harus sudah dikonfirmasi sebelum barangnya bisa mulai diterima — komitmen
 * yang masih draft berarti isinya bisa berubah, dan menerima barang atasnya
 * berarti mencatat stok atas kesepakatan yang belum final.
 */
export async function assertPurchaseConfirmed(purchaseId: string): Promise<void> {
  const purchase = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseId },
    select: { status: true },
  });
  if (!purchase) throw new NotFoundError('Dokumen PO yang dipilih tidak ditemukan.');
  if (purchase.status !== 'CONFIRMED') {
    throw new ValidationError('Dokumen PO ini belum dikonfirmasi, jadi belum bisa menerima barang.');
  }
}

/** Setiap baris penerimaan wajib menunjuk barang PO yang sama dengan dokumennya. */
export async function assertLinesBelongToPurchase(
  purchaseId: string,
  purchaseItemIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(purchaseItemIds)];
  const items = await prisma.purchaseOrderItem.findMany({
    where: { id: { in: unique }, purchaseId },
    select: { id: true },
  });
  if (items.length !== unique.length) {
    throw new ValidationError('Ada baris barang yang tidak ditemukan pada dokumen PO ini.');
  }
}

export function toDeliveryLineRows(lines: CreateMetalPurchaseDeliveryInput['lines']) {
  return lines.map((line) => ({
    purchaseItemId: line.purchase_item_id,
    weightGram: line.weight_gram,
    purityPercent: line.purity_percent,
    // Belum ada kadar hasil timbang ulang yang berbeda dari perjanjian di form ini —
    // dipakai apa adanya, sama seperti berat murni PO.
    fineWeightGram: Math.round(((line.weight_gram * line.purity_percent) / 100) * 10000) / 10000,
    note: line.note,
  }));
}

export function toDeliveryChargeRows(charges: CreateMetalPurchaseDeliveryInput['charges']) {
  return charges.map((charge, index) => ({
    lineNo: index + 1,
    name: charge.name,
    amountIdr: charge.amount_idr,
  }));
}

export function metalPurchaseDeliveryColumns(body: CreateMetalPurchaseDeliveryInput) {
  return {
    purchaseId: body.purchase_id,
    date: toUtcDateOnly(body.date),
    courierPartnerId: body.courier_partner_id,
    trackingNumber: body.tracking_number,
    receivedByName: body.received_by_name,
    corNumber: body.cor_number,
    supplierDoNumber: body.supplier_do_number,
    pibNo: body.pib_no,
    sppbNo: body.sppb_no,
    mawbNo: body.mawb_no,
    barSerialNumbers: body.bar_serial_numbers,
    notes: body.notes,
  };
}

export async function assertDeliveryDraft(id: string): Promise<void> {
  const delivery = await prisma.goodsReceipt.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');
  if (delivery.status !== 'DRAFT') {
    throw new ConflictError(
      `Tanda terima ini berstatus ${METAL_PURCHASE_DELIVERY_STATUS_LABELS[delivery.status]}, jadi tidak bisa diubah lagi.`,
    );
  }
}

export async function deleteMetalPurchaseDelivery(id: string): Promise<void> {
  const delivery = await prisma.goodsReceipt.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');
  if (delivery.status !== 'DRAFT') {
    throw new ConflictError('Hanya draft yang bisa dihapus. Tanda terima yang sudah berjalan dibatalkan, bukan dihapus.');
  }

  await prisma.goodsReceipt.delete({ where: { id } });
}
