import type {
  MetalMovementDirection,
  MetalMovementStatus,
  MetalMovementType,
} from '@/types/value-objects';

/**
 * Label Bahasa Indonesia untuk ledger mutasi (`MetalMovement`). Murni, tanpa
 * Prisma — boleh diimpor komponen client. Yang menulis ada di
 * `src/lib/metal-movement-write.ts`.
 */

export const METAL_MOVEMENT_DIRECTION_LABELS: Record<MetalMovementDirection, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
};

export const METAL_MOVEMENT_STATUS_LABELS: Record<MetalMovementStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Diposting',
  VOID: 'Dibatalkan',
};

/** Cuma `RECEIPT` yang punya gerbang tulis sejauh ini — lihat komentar enum di schema. */
export const METAL_MOVEMENT_TYPE_LABELS: Record<MetalMovementType, string> = {
  RECEIPT: 'Penerimaan Pembelian',
  SORT: 'Sortir',
  TRANSFER: 'Transfer Antar-Lokasi',
  REFINE_OUT: 'Keluar Peleburan',
  REFINE_IN: 'Masuk Hasil Peleburan',
  PRODUCTION: 'Produksi',
  ISSUE: 'Pengeluaran',
  ADJUSTMENT: 'Penyesuaian',
};
