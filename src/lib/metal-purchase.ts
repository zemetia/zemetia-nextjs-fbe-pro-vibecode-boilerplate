import { fineWeight } from '@/lib/metal-lot';
import { roundTo } from '@/lib/number';
import { toGram, WEIGHT_SCALE } from '@/lib/weight';
import type { PriceBasis, WeightUnit } from '@/types/value-objects';

export const METAL_PURCHASE_PRICE_SCALE = 8;

export const METAL_PURCHASE_TYPES = ['LOCAL', 'IMPORT'] as const;

export const METAL_PURCHASE_PAYMENT_TYPES = ['PO', 'DP'] as const;

export const METAL_PURCHASE_STATUSES = ['DRAFT', 'CONFIRMED', 'VOID'] as const;

export const METAL_PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Terkonfirmasi',
  RECEIVED: 'Diterima',
  VOID: 'Dibatalkan',
};

export const METAL_PURCHASE_TYPE_LABELS: Record<string, string> = {
  LOCAL: 'Lokal (IDR)',
  IMPORT: 'Impor (Valas)',
};

export const METAL_PURCHASE_PAYMENT_TYPE_LABELS: Record<string, string> = {
  PO: 'PO (Tempo)',
  DP: 'DP (Direct Payment)',
};

export const METAL_PURCHASE_TYPE_OPTIONS = [
  { value: 'LOCAL', label: 'Lokal (IDR)' },
  { value: 'IMPORT', label: 'Impor (Valas)' },
];

export const METAL_PURCHASE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Terkonfirmasi' },
  { value: 'VOID', label: 'Dibatalkan' },
];

export const METAL_PURCHASE_STATUS_BADGE: Record<string, 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'warning',
  CONFIRMED: 'success',
  VOID: 'destructive',
};

export const METAL_PURCHASE_DELIVERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_TRANSIT: 'Dalam Perjalanan',
  CONFIRMED: 'Diterima',
  VOID: 'Dibatalkan',
};

export const METAL_PURCHASE_DELIVERY_STATUS_BADGE: Record<
  string,
  'warning' | 'secondary' | 'success' | 'destructive'
> = {
  DRAFT: 'warning',
  IN_TRANSIT: 'secondary',
  CONFIRMED: 'success',
  VOID: 'destructive',
};

/** Hanya draft yang boleh diubah/dihapus — dikonfirmasi dikoreksi dengan membatalkan, bukan diedit. */
export function isMetalPurchaseEditable(status: string): boolean {
  return status === 'DRAFT';
}

export function isMetalPurchaseVoidable(status: string): boolean {
  return status === 'CONFIRMED';
}

export function isMetalPurchaseDeliveryEditable(status: string): boolean {
  return status === 'DRAFT';
}

export function isMetalPurchaseDeliveryVoidable(status: string): boolean {
  return status === 'IN_TRANSIT' || status === 'CONFIRMED';
}

/** Akun hutang usaha PT TAN di COA aktif Prisma — `2110`, bukan `2111` (Uang Titipan Customer). */
export const PAYABLE_ACCOUNT_CODE = '2110';

export interface MetalPurchaseItemInput {
  weight: number;
  weightUnit?: WeightUnit;
  purityPercent: number;
  pure: boolean;
  priceBasis: PriceBasis;
  pricePerUnit: number;
}

export interface MetalPurchaseItemComputed {
  weightGram: number;
  fineWeightGram: number;
  amount: number;
}

export function computeMetalPurchaseItem(input: MetalPurchaseItemInput): MetalPurchaseItemComputed {
  const weightGram = toGram(input.weight, input.weightUnit ?? 'GRAM');
  const fineWeightGram = fineWeight(weightGram, input.purityPercent, { pure: input.pure });
  const amount = roundTo(input.weight * input.pricePerUnit, 2);

  return {
    weightGram: roundTo(weightGram, WEIGHT_SCALE),
    fineWeightGram: roundTo(fineWeightGram, WEIGHT_SCALE),
    amount,
  };
}

// ── Jurnal TTB (src/lib/metal-purchase-journal.ts) ──────────────────────────

export interface JournalAccountLine {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
}

/**
 * Jurnal saat TTB berangkat (`IN_TRANSIT`) — hak milik pindah, hutang usaha
 * lahir. Debet ke akun transit produk (biasanya `1159`); tanpa akun transit,
 * penerimaan ini tidak bisa dikonfirmasi lewat jalur berjenjang.
 */
export function buildShipmentJournalLines(
  rows: readonly { transitAccountId: string; amount: number; memo: string }[],
  payableAccountId: string,
): JournalAccountLine[] {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return [
    ...rows.map((row) => ({ accountId: row.transitAccountId, debit: row.amount, memo: row.memo })),
    { accountId: payableAccountId, credit: total, memo: null },
  ];
}

/**
 * Jurnal saat TTB dikonfirmasi (barang diterima fisik).
 *
 * Dua bentuk, ditentukan pemanggil lewat `contraAccountId` tiap baris:
 * - **Langsung** (dilompati `IN_TRANSIT`): Debet persediaan / Kredit hutang usaha — satu jurnal.
 * - **Menutup transit** (menyusul `IN_TRANSIT`): Debet persediaan / Kredit akun transit — menutup saldo transit ke nol, hutangnya sudah lahir di tahap sebelumnya.
 */
export function buildReceiptJournalLines(
  rows: readonly { inventoryAccountId: string; contraAccountId: string; amount: number; memo: string }[],
): JournalAccountLine[] {
  const byContra = new Map<string, number>();
  for (const row of rows) {
    byContra.set(row.contraAccountId, (byContra.get(row.contraAccountId) ?? 0) + row.amount);
  }

  return [
    ...rows.map((row) => ({ accountId: row.inventoryAccountId, debit: row.amount, memo: row.memo })),
    ...[...byContra.entries()].map(([accountId, amount]) => ({ accountId, credit: amount, memo: null })),
  ];
}
