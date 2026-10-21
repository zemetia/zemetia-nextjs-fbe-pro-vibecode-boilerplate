import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import type { MetalPurchaseDeliveryDetailDTO, MetalPurchaseDeliveryDTO } from '@/types/dtos';

export const METAL_PURCHASE_DELIVERY_INCLUDE = {
  purchase: { select: { id: true, number: true, paymentType: true, type: true } },
  courierPartner: { select: { id: true, code: true, name: true } },
} as const;

export const METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE = {
  ...METAL_PURCHASE_DELIVERY_INCLUDE,
  lines: {
    include: {
      purchaseItem: {
        select: { id: true, product: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  charges: { orderBy: { lineNo: 'asc' } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} as const;

export type MetalPurchaseDeliveryRow = Prisma.GoodsReceiptGetPayload<{
  include: typeof METAL_PURCHASE_DELIVERY_INCLUDE;
}>;

export type MetalPurchaseDeliveryDetailRow = Prisma.GoodsReceiptGetPayload<{
  include: typeof METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE;
}>;

export interface DeliveryJournalRef {
  id: string;
  number: string;
  status: string;
}

function decimal(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

function nullableDecimal(value: Prisma.Decimal | null): number | null {
  return value !== null ? Number(value) : null;
}

export function toMetalPurchaseDeliveryDTO(row: MetalPurchaseDeliveryRow): MetalPurchaseDeliveryDTO {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    purchase: {
      id: row.purchase.id,
      number: row.purchase.number,
      payment_type: row.purchase.paymentType,
      type: row.purchase.type,
    },
    date: fromUtcDateOnly(row.date),
    courier_partner: row.courierPartner
      ? { id: row.courierPartner.id, code: row.courierPartner.code, name: row.courierPartner.name }
      : null,
    tracking_number: row.trackingNumber,
    received_by_name: row.receivedByName,
    cor_number: row.corNumber,
    supplier_do_number: row.supplierDoNumber,
    pib_no: row.pibNo,
    sppb_no: row.sppbNo,
    mawb_no: row.mawbNo,
    bar_serial_numbers: row.barSerialNumbers,
    assay_certificate_no: row.assayCertificateNo,
    safe_box_slot: row.safeBoxSlot,
    security_seal_no: row.securitySealNo,
    document_weight_gram: nullableDecimal(row.documentWeightGram),
    received_weight_gram: nullableDecimal(row.receivedWeightGram),
    weight_discrepancy_gram: nullableDecimal(row.weightDiscrepancyGram),
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toMetalPurchaseDeliveryDetailDTO(
  row: MetalPurchaseDeliveryDetailRow,
  journal: DeliveryJournalRef | null = null,
): MetalPurchaseDeliveryDetailDTO {
  return {
    ...toMetalPurchaseDeliveryDTO(row),
    lines: row.lines.map((line) => ({
      id: line.id,
      purchase_item_id: line.purchaseItemId,
      product: {
        id: line.purchaseItem.product.id,
        code: line.purchaseItem.product.code,
        name: line.purchaseItem.product.name,
      },
      weight_gram: decimal(line.weightGram),
      purity_percent: decimal(line.purityPercent),
      fine_weight_gram: decimal(line.fineWeightGram),
      note: line.note,
    })),
    charges: row.charges.map((charge) => ({
      id: charge.id,
      line_no: charge.lineNo,
      name: charge.name,
      amount_idr: decimal(charge.amountIdr),
    })),
    confirmed_by: row.confirmedBy,
    confirmed_at: row.confirmedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    journal,
    updated_at: row.updatedAt.toISOString(),
  };
}
