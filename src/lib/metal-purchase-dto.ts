import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import type { MetalPurchaseDetailDTO, MetalPurchaseDTO } from '@/types/dtos';

/** Relasi yang dibawa tiap respons pembelian — daftar dan detail memakai include yang sama. */
export const METAL_PURCHASE_INCLUDE = {
  partner: { select: { id: true, code: true, name: true } },
  purchaseRequest: { select: { id: true, number: true } },
} as const;

export const METAL_PURCHASE_DETAIL_INCLUDE = {
  ...METAL_PURCHASE_INCLUDE,
  items: {
    orderBy: { lineNo: 'asc' },
    include: { product: { select: { id: true, code: true, name: true } } },
  },
  charges: { orderBy: { lineNo: 'asc' } },
  payments: { orderBy: { lineNo: 'asc' } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} as const;

export type MetalPurchaseRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof METAL_PURCHASE_INCLUDE;
}>;

export type MetalPurchaseDetailRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof METAL_PURCHASE_DETAIL_INCLUDE;
}>;

function decimal(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

export function toMetalPurchaseDTO(row: MetalPurchaseRow): MetalPurchaseDTO {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    payment_type: row.paymentType,
    status: row.status,
    partner: { id: row.partner.id, code: row.partner.code, name: row.partner.name },
    date: fromUtcDateOnly(row.date),
    due_date: row.dueDate ? fromUtcDateOnly(row.dueDate) : null,
    supplier_invoice_number: row.supplierInvoiceNumber,
    currency_code: row.currencyCode,
    exchange_rate: row.exchangeRate ? Number(row.exchangeRate) : null,
    pib_number: row.pibNumber,
    sppb_number: row.sppbNumber,
    mawb_number: row.mawbNumber,
    courier_name: row.courierName,
    courier_mandate_number: row.courierMandateNumber,
    goods_amount: decimal(row.goodsAmount),
    notes: row.notes,
    payment_status: row.paymentStatus,
    paid_amount_idr: decimal(row.paidAmountIdr),
    remaining_balance_idr: row.remainingBalanceIdr === null ? null : decimal(row.remainingBalanceIdr),
    purchase_request_id: row.purchaseRequest?.id ?? null,
    purchase_request_number: row.purchaseRequest?.number ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export function toMetalPurchaseDetailDTO(row: MetalPurchaseDetailRow): MetalPurchaseDetailDTO {
  return {
    ...toMetalPurchaseDTO(row),
    items: row.items.map((item) => ({
      id: item.id,
      line_no: item.lineNo,
      product: { id: item.product.id, code: item.product.code, name: item.product.name },
      weight_unit: item.weightUnit,
      weight_gram: decimal(item.weightGram),
      purity_percent: decimal(item.purityPercent),
      fine_weight_gram: decimal(item.fineWeightGram),
      price_basis: item.priceBasis,
      price_per_unit: decimal(item.pricePerUnit),
      amount: decimal(item.amount),
      notes: item.notes,
    })),
    charges: row.charges.map((charge) => ({
      id: charge.id,
      line_no: charge.lineNo,
      name: charge.name,
      amount_idr: decimal(charge.amountIdr),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      line_no: payment.lineNo,
      voucher_no: payment.voucherNo,
      voucher_type: payment.voucherType,
      date: payment.date ? fromUtcDateOnly(payment.date) : null,
      category: payment.category,
      category_label: payment.categoryLabel,
      payee: payment.payee,
      bank: payment.bank,
      bank_account_code: payment.bankAccountCode,
      account_code: payment.accountCode,
      amount: decimal(payment.amount),
      notes: payment.notes,
    })),
    confirmed_by: row.confirmedBy,
    confirmed_at: row.confirmedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    updated_at: row.updatedAt.toISOString(),
  };
}
