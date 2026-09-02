import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import type {
  SalesDeliveryDTO,
  SalesDeliveryDetailDTO,
  SalesInvoiceDTO,
  SalesInvoiceDetailDTO,
  SalesOrderDTO,
  SalesOrderDetailDTO,
} from '@/types/dtos';

/** Relasi yang dibawa tiap respons SO — daftar dan detail memakai include yang sama. */
export const SALES_ORDER_INCLUDE = {
  partner: { select: { id: true, code: true, name: true } },
  items: {
    take: 1,
    orderBy: { lineNo: 'asc' },
    include: { product: { select: { id: true, code: true, name: true } } },
  },
} as const;

export const SALES_ORDER_DETAIL_INCLUDE = {
  ...SALES_ORDER_INCLUDE,
  items: {
    orderBy: { lineNo: 'asc' },
    include: { product: { select: { id: true, code: true, name: true } } },
  },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  directorApprovedBy: { select: { id: true, name: true } },
} as const;

export type SalesOrderRow = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_INCLUDE;
}>;

export type SalesOrderDetailRow = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_DETAIL_INCLUDE;
}>;

function decimal(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

export function toSalesOrderDTO(row: SalesOrderRow): SalesOrderDTO {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    payment_type: row.paymentType,
    status: row.status,
    partner: { id: row.partner.id, code: row.partner.code, name: row.partner.name },
    date: fromUtcDateOnly(row.date),
    due_date: row.dueDate ? fromUtcDateOnly(row.dueDate) : null,
    customer_po_number: row.customerPoNumber,
    currency_code: row.currencyCode,
    exchange_rate: row.exchangeRate ? Number(row.exchangeRate) : null,
    goods_amount: decimal(row.goodsAmount),
    payment_status: row.paymentStatus,
    paid_amount_idr: decimal(row.paidAmountIdr),
    remaining_balance_idr: row.remainingBalanceIdr ? Number(row.remainingBalanceIdr) : null,
    first_item: row.items[0]
      ? {
          product: { id: row.items[0].product.id, code: row.items[0].product.code, name: row.items[0].product.name },
          weight_gram: decimal(row.items[0].weightGram),
          purity_percent: decimal(row.items[0].purityPercent),
          price_per_unit: decimal(row.items[0].pricePerUnit),
          amount: decimal(row.items[0].amount),
        }
      : null,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toSalesOrderDetailDTO(row: SalesOrderDetailRow): SalesOrderDetailDTO {
  return {
    ...toSalesOrderDTO(row),
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
    confirmed_by: row.confirmedBy,
    confirmed_at: row.confirmedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    director_approved_by: row.directorApprovedBy,
    director_approved_at: row.directorApprovedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

// ── Surat Jalan ──────────────────────────────────────────────────────────────

export const SALES_DELIVERY_INCLUDE = {
  order: { select: { id: true, number: true, paymentType: true } },
  lines: {
    select: { grossWeightGram: true, fineWeightGram: true },
  },
} as const;

export const SALES_DELIVERY_DETAIL_INCLUDE = {
  ...SALES_DELIVERY_INCLUDE,
  lines: {
    orderBy: { id: 'asc' },
    include: {
      orderItem: {
        include: { product: { select: { id: true, code: true, name: true } } },
      },
      lot: { select: { id: true, code: true, serialNumber: true, certificateNumber: true } },
      location: { select: { id: true, code: true, name: true } },
    },
  },
  charges: { orderBy: { lineNo: 'asc' } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  journalEntries: { select: { id: true, number: true, status: true }, take: 1 },
} as const;

export type SalesDeliveryRow = Prisma.SalesDeliveryGetPayload<{
  include: typeof SALES_DELIVERY_INCLUDE;
}>;

export type SalesDeliveryDetailRow = Prisma.SalesDeliveryGetPayload<{
  include: typeof SALES_DELIVERY_DETAIL_INCLUDE;
}>;

export function toSalesDeliveryDTO(row: SalesDeliveryRow): SalesDeliveryDTO {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    order: { id: row.order.id, number: row.order.number, payment_type: row.order.paymentType },
    date: fromUtcDateOnly(row.date),
    recipient_name: row.recipientName,
    delivery_method: row.deliveryMethod,
    courier_name: row.courierName,
    carrier_name: row.carrierName,
    awb_number: row.awbNumber,
    peb_number: row.pebNumber,
    movement_id: row.movementId,
    total_weight_gram: row.lines.reduce((sum, line) => sum + decimal(line.grossWeightGram), 0),
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toSalesDeliveryDetailDTO(row: SalesDeliveryDetailRow): SalesDeliveryDetailDTO {
  return {
    ...toSalesDeliveryDTO(row),
    lines: row.lines.map((line) => ({
      id: line.id,
      order_item_id: line.orderItemId,
      product: { id: line.orderItem.product.id, code: line.orderItem.product.code, name: line.orderItem.product.name },
      lot: {
        id: line.lot.id,
        code: line.lot.code,
        serial_number: line.lot.serialNumber,
        certificate_number: line.lot.certificateNumber,
      },
      location: { id: line.location.id, code: line.location.code, name: line.location.name },
      piece_count: line.pieceCount,
      gross_weight_gram: decimal(line.grossWeightGram),
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
    journal: row.journalEntries[0] ? { id: row.journalEntries[0].id, number: row.journalEntries[0].number, status: row.journalEntries[0].status } : null,
    updated_at: row.updatedAt.toISOString(),
  };
}

// ── Faktur ───────────────────────────────────────────────────────────────────

export const SALES_INVOICE_INCLUDE = {
  order: { select: { id: true, number: true, paymentType: true } },
} as const;

export const SALES_INVOICE_DETAIL_INCLUDE = {
  ...SALES_INVOICE_INCLUDE,
  items: {
    orderBy: { id: 'asc' },
    include: { orderItem: { include: { product: { select: { id: true, code: true, name: true } } } } },
  },
  payments: { orderBy: { lineNo: 'desc' } },
  directorApprovedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  journalEntries: { select: { id: true, number: true, status: true }, take: 1 },
} as const;

export type SalesInvoiceRow = Prisma.SalesInvoiceGetPayload<{
  include: typeof SALES_INVOICE_INCLUDE;
}>;

export type SalesInvoiceDetailRow = Prisma.SalesInvoiceGetPayload<{
  include: typeof SALES_INVOICE_DETAIL_INCLUDE;
}>;

export function toSalesInvoiceDTO(row: SalesInvoiceRow): SalesInvoiceDTO {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    status: row.status,
    order: { id: row.order.id, number: row.order.number, payment_type: row.order.paymentType },
    date: fromUtcDateOnly(row.date),
    due_date: row.dueDate ? fromUtcDateOnly(row.dueDate) : null,
    currency_code: row.currencyCode,
    exchange_rate: row.exchangeRate ? Number(row.exchangeRate) : null,
    subtotal_amount: decimal(row.subtotalAmount),
    dp_amount: decimal(row.dpAmount),
    total_amount: decimal(row.totalAmount),
    tax_facility: row.taxFacility,
    tax_amount_idr: row.taxAmountIdr ? Number(row.taxAmountIdr) : null,
    payment_mode: row.paymentMode,
    payment_status: row.paymentStatus,
    paid_amount_idr: decimal(row.paidAmountIdr),
    remaining_balance_idr: row.remainingBalanceIdr ? Number(row.remainingBalanceIdr) : null,
    dhe_bca_account: row.dheBcaAccount,
    peb_number: row.pebNumber,
    awb_number: row.awbNumber,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toSalesInvoiceDetailDTO(row: SalesInvoiceDetailRow): SalesInvoiceDetailDTO {
  return {
    ...toSalesInvoiceDTO(row),
    items: row.items.map((item) => ({
      id: item.id,
      order_item_id: item.orderItemId,
      product: { id: item.orderItem.product.id, code: item.orderItem.product.code, name: item.orderItem.product.name },
      weight_gram: decimal(item.weightGram),
      amount: decimal(item.amount),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      line_no: payment.lineNo,
      voucher_no: payment.voucherNo,
      voucher_type: payment.voucherType,
      date: payment.date ? fromUtcDateOnly(payment.date) : null,
      bank: payment.bank,
      amount: decimal(payment.amount),
      notes: payment.notes,
      recorded_at: payment.recordedAt.toISOString(),
    })),
    director_approved_by: row.directorApprovedBy,
    director_approved_at: row.directorApprovedAt?.toISOString() ?? null,
    created_by: row.createdBy,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    journal: row.journalEntries[0] ? { id: row.journalEntries[0].id, number: row.journalEntries[0].number, status: row.journalEntries[0].status } : null,
    updated_at: row.updatedAt.toISOString(),
  };
}
