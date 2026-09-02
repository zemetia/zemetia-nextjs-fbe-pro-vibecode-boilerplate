import { fineWeight } from '@/lib/metal-lot';
import { roundTo } from '@/lib/number';
import { toGram, WEIGHT_SCALE } from '@/lib/weight';
import type { PriceBasis, WeightUnit } from '@/types/value-objects';

export const SALES_PRICE_SCALE = 8;

export const SALES_TYPES = ['EXPORT', 'LOCAL'] as const;

export const SALES_PAYMENT_TYPES = ['PO', 'DP'] as const;

export const SALES_STATUSES = ['DRAFT', 'CONFIRMED', 'VOID'] as const;

export const SALES_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Terkonfirmasi',
  VOID: 'Dibatalkan',
};

export const SALES_TYPE_LABELS: Record<string, string> = {
  EXPORT: 'Ekspor (Valas)',
  LOCAL: 'Lokal (IDR)',
};

export const SALES_PAYMENT_TYPE_LABELS: Record<string, string> = {
  PO: 'PO (Tempo)',
  DP: 'DP (Direct Payment)',
};

export const SALES_TYPE_OPTIONS = [
  { value: 'LOCAL', label: 'Lokal (IDR)' },
  { value: 'EXPORT', label: 'Ekspor (Valas)' },
];

export const SALES_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Terkonfirmasi' },
  { value: 'VOID', label: 'Dibatalkan' },
];

export const SALES_STATUS_BADGE: Record<string, 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'warning',
  CONFIRMED: 'success',
  VOID: 'destructive',
};

// ── Surat Jalan ──────────────────────────────────────────────────────────────

export const SALES_DELIVERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Terkirim',
  VOID: 'Dibatalkan',
};

export const SALES_DELIVERY_STATUS_BADGE: Record<
  string,
  'warning' | 'success' | 'destructive'
> = {
  DRAFT: 'warning',
  CONFIRMED: 'success',
  VOID: 'destructive',
};

export const SALES_DELIVERY_METHOD_LABELS: Record<string, string> = {
  COUNTER: 'Kounter',
  KURIR_INTERNAL: 'Kurir Internal',
  EXPEDITION: 'Ekspedisi',
};

export const SALES_DELIVERY_METHOD_OPTIONS = [
  { value: 'COUNTER', label: 'Kounter' },
  { value: 'KURIR_INTERNAL', label: 'Kurir Internal' },
  { value: 'EXPEDITION', label: 'Ekspedisi' },
];

// ── Faktur ───────────────────────────────────────────────────────────────────

export const SALES_INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  POSTED: 'Terbit (Ditagih)',
  VOID: 'Dibatalkan',
};

export const SALES_INVOICE_STATUS_BADGE: Record<
  string,
  'warning' | 'success' | 'destructive'
> = {
  DRAFT: 'warning',
  POSTED: 'success',
  VOID: 'destructive',
};

export const SALES_INVOICE_PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'Tunai / Transfer Lunas',
  CREDIT: 'Tempo (Kredit)',
  DP: 'Uang Muka (DP)',
};

export const SALES_INVOICE_PAYMENT_MODE_OPTIONS = [
  { value: 'CASH', label: 'Tunai / Transfer Lunas' },
  { value: 'CREDIT', label: 'Tempo (Kredit)' },
  { value: 'DP', label: 'Uang Muka (DP)' },
];

export const SALES_PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Belum Dibayar',
  PARTIALLY_PAID: 'Sebagian Dibayar',
  PAID: 'Lunas',
};

export const SALES_PAYMENT_STATUS_BADGE: Record<
  string,
  'destructive' | 'warning' | 'success'
> = {
  UNPAID: 'destructive',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
};

/** Hanya draft yang boleh diubah/dihapus — dikonfirmasi dikoreksi dengan membatalkan, bukan diedit. */
export function isSalesOrderEditable(status: string): boolean {
  return status === 'DRAFT';
}

export function isSalesOrderVoidable(status: string): boolean {
  return status === 'CONFIRMED';
}

export function isSalesDeliveryEditable(status: string): boolean {
  return status === 'DRAFT';
}

export function isSalesDeliveryVoidable(status: string): boolean {
  return status === 'CONFIRMED';
}

export function isSalesInvoiceEditable(status: string): boolean {
  return status === 'DRAFT';
}

export function isSalesInvoicePostable(status: string): boolean {
  return status === 'DRAFT';
}

export function isSalesInvoiceVoidable(status: string): boolean {
  return status === 'POSTED';
}

/** Akun penjualan PT TAN di COA aktif Prisma (semuanya bertipe `detail`). */
export const RECEIVABLE_LOCAL_ACCOUNT_CODE = '1130';
export const RECEIVABLE_EXPORT_ACCOUNT_CODE = '1132';
export const SALES_REVENUE_LOCAL_ACCOUNT_CODE = '4111';
export const SALES_REVENUE_EXPORT_ACCOUNT_CODE = '4116';
export const SALES_DOWN_PAYMENT_ACCOUNT_CODE = '2150';
export const COGS_LOCAL_ACCOUNT_CODE = '5114';
export const COGS_EXPORT_ACCOUNT_CODE = '5115';

export interface SalesOrderItemInput {
  weight: number;
  weightUnit?: WeightUnit;
  purityPercent: number;
  pure: boolean;
  priceBasis: PriceBasis;
  pricePerUnit: number;
}

export interface SalesOrderItemComputed {
  weightGram: number;
  fineWeightGram: number;
  amount: number;
}

export function computeSalesOrderItem(input: SalesOrderItemInput): SalesOrderItemComputed {
  const weightGram = toGram(input.weight, input.weightUnit ?? 'GRAM');
  const fineWeightGram = fineWeight(weightGram, input.purityPercent, { pure: input.pure });
  const amount = roundTo(input.weight * input.pricePerUnit, 2);

  return {
    weightGram: roundTo(weightGram, WEIGHT_SCALE),
    fineWeightGram: roundTo(fineWeightGram, WEIGHT_SCALE),
    amount,
  };
}
