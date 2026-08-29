export const METAL_MOVEMENT_DIRECTION_LABELS: Record<string, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
  INTERNAL: 'Internal',
};

export const METAL_MOVEMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  POSTED: 'Diposting',
  VOID: 'Dibatalkan',
};

export const METAL_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Pembelian',
  PRODUCTION_ISSUE: 'Pengeluaran Bahan SPK',
  PRODUCTION_RECEIPT: 'Penerimaan Hasil SPK',
  PRODUCTION_RETURN: 'Pengembalian Bahan SPK',
  SALES: 'Penjualan',
  ADJUSTMENT: 'Penyesuaian',
};

export const BALANCED_MOVEMENT_TYPES = ['PRODUCTION_RECEIPT', 'REFINE', 'SORT'] as const;
export const LOSSLESS_MOVEMENT_TYPES = [
  'PURCHASE',
  'PRODUCTION_ISSUE',
  'PRODUCTION_RETURN',
  'SALES',
  'INTERNAL_TRANSFER',
] as const;
