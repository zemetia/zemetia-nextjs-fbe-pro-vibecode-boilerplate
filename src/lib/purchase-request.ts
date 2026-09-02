import { roundTo } from '@/lib/number';
import { WEIGHT_SCALE } from '@/lib/weight';
import type {
  PurchaseRequestCategory,
  PurchaseRequestPriority,
  PurchaseRequestStage,
  PurchaseRequestStatus,
} from '@/types/value-objects';

export const PURCHASE_REQUEST_STATUSES = ['DRAFT', 'APPROVED', 'VOID'] as const;

export const PURCHASE_REQUEST_CATEGORIES = [
  'GOLD_IMPORT',
  'GOLD_LOCAL',
  'SUPPLY',
  'CHEMICALS_REFINERY',
  'SAFETY_GA',
] as const;

export const PURCHASE_REQUEST_PRIORITIES = ['NORMAL', 'URGENT'] as const;

export const PURCHASE_REQUEST_CATEGORY_LABELS: Record<PurchaseRequestCategory, string> = {
  GOLD_IMPORT: 'Logam Impor',
  GOLD_LOCAL: 'Logam Lokal',
  SUPPLY: 'Barang Non-Logam',
  CHEMICALS_REFINERY: 'Bahan Kimia & Kowi Refineri',
  SAFETY_GA: 'Perlengkapan K3/GA',
};

export const PURCHASE_REQUEST_CATEGORY_DESCRIPTIONS: Record<PurchaseRequestCategory, string> = {
  GOLD_IMPORT: 'Emas atau perak dari refinery luar negeri.',
  GOLD_LOCAL: 'Logam dari mitra dalam negeri, termasuk perhiasan untuk dilebur.',
  SUPPLY:
    'Bahan kimia, alat, dan keperluan kantor.',
  CHEMICALS_REFINERY:
    'Asam nitrat, kowi grafit, dan bahan kimia proses refineri.',
  SAFETY_GA:
    'Alat pelindung diri dan perlengkapan K3/GA.',
};

export const PURCHASE_REQUEST_PRIORITY_LABELS: Record<PurchaseRequestPriority, string> = {
  NORMAL: 'Normal',
  URGENT: 'Mendesak',
};

export const PURCHASE_REQUEST_STAGE_LABELS: Record<PurchaseRequestStage, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Disetujui',
  CONVERTED: 'Sudah diproses',
  VOID: 'Dibatalkan',
};

export const PURCHASE_REQUEST_STAGE_DESCRIPTIONS: Record<PurchaseRequestStage, string> = {
  DRAFT: 'Masih milik pengaju — boleh diubah dan dihapus.',
  APPROVED: 'Sudah disetujui; isinya terkunci.',
  CONVERTED: 'Seluruh barisnya sudah tertutup.',
  VOID: 'Dibatalkan; catatannya tetap disimpan.',
};

export const PURCHASE_REQUEST_CATEGORY_OPTIONS = PURCHASE_REQUEST_CATEGORIES.map((value) => ({
  value,
  label: PURCHASE_REQUEST_CATEGORY_LABELS[value],
}));

export const PURCHASE_REQUEST_PRIORITY_OPTIONS = PURCHASE_REQUEST_PRIORITIES.map((value) => ({
  value,
  label: PURCHASE_REQUEST_PRIORITY_LABELS[value],
}));

export const PURCHASE_REQUEST_STATUS_OPTIONS = PURCHASE_REQUEST_STATUSES.map((value) => ({
  value,
  label: PURCHASE_REQUEST_STAGE_LABELS[value],
}));

export function isMetalCategory(category: PurchaseRequestCategory): boolean {
  return category === 'GOLD_IMPORT' || category === 'GOLD_LOCAL';
}

/** Hanya draft yang masih selembar usulan; sesudahnya ia sudah jadi janji. */
export function isPurchaseRequestEditable(status: PurchaseRequestStatus): boolean {
  return status === 'DRAFT';
}

export function canApprovePurchaseRequest(status: PurchaseRequestStatus): boolean {
  return status === 'DRAFT';
}

/**
 * Draft dibatalkan juga, bukan cuma yang sudah disetujui: permintaan yang
 * terlanjur salah kategori lebih jujur ditutup dengan alasannya daripada dihapus
 * diam-diam — kecuali memang belum pernah dilihat siapa pun, dan untuk itu ada
 * hapus.
 */
export function canVoidPurchaseRequest(status: PurchaseRequestStatus): boolean {
  return status === 'DRAFT' || status === 'APPROVED';
}

export function canDeletePurchaseRequest(status: PurchaseRequestStatus): boolean {
  return status === 'DRAFT';
}

/**
 * Boleh dikonversi jadi PO: sudah disetujui, kategorinya logam, dan masih ada
 * yang belum dipesan. Satu permintaan boleh dikonversi berkali-kali — yang
 * menutup pintunya adalah sisanya habis, bukan sebuah kolom "sudah pernah".
 */
export function canConvertPurchaseRequest(
  status: PurchaseRequestStatus,
  category: PurchaseRequestCategory,
  isFulfilled: boolean,
): boolean {
  return status === 'APPROVED' && isMetalCategory(category) && !isFulfilled;
}

/**
 * Tahap yang dibaca layar. Permintaan yang seluruh barisnya sudah tertutup PO
 * berhenti disebut "Disetujui" dan mulai disebut "Sudah jadi PO" — tanpa satu
 * pun kolom berubah.
 */
export function purchaseRequestStage(
  status: PurchaseRequestStatus,
  isFulfilled: boolean,
): PurchaseRequestStage {
  return status === 'APPROVED' && isFulfilled ? 'CONVERTED' : status;
}

/**
 * Nilai perkiraan satu baris. Harga dikutip **per satuan yang diketik petugas**,
 * sedangkan jumlahnya disimpan dalam satuan anchor kategorinya (gram untuk
 * berat, liter untuk volume, dst) — jadi baris yang diminta per troy ounce
 * dikalikan dalam troy ounce, bukan gramnya dikalikan harga per ounce.
 * `unitConversionFactor` adalah `Unit.conversionFactor` baris ini: nilai
 * anchor dibagi faktor itu untuk balik ke satuan yang diketik.
 */
export function estimatedLineAmount(
  quantityAnchor: number,
  unitConversionFactor: number,
  pricePerUnit: number,
): number {
  const quantityInUnit = quantityAnchor / unitConversionFactor;

  return roundTo(quantityInUnit * pricePerUnit, 2);
}

/** Sisa satu baris — tidak pernah negatif, PO berlebih tidak melahirkan hutang. */
export function outstandingQuantity(quantity: number, ordered: number): number {
  return roundTo(Math.max(0, quantity - ordered), WEIGHT_SCALE);
}
