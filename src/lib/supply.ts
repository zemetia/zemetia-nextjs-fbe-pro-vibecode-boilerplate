import type { SupplyCategory } from '@/types/value-objects';

/**
 * Kosakata master barang non-logam. Murni — dibaca form di browser maupun route
 * handler di server, jadi ia tidak boleh menyentuh Prisma.
 */

export const SUPPLY_CATEGORIES = ['CHEMICAL', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  CHEMICAL: 'Bahan Kimia',
  CONSUMABLE: 'Pakai Habis',
  EQUIPMENT: 'Peralatan',
  OTHER: 'Lain-lain',
};

export const SUPPLY_CATEGORY_DESCRIPTIONS: Record<SupplyCategory, string> = {
  CHEMICAL: 'Asam, reagen, larutan uji — bahan proses dan lab.',
  CONSUMABLE: 'Kowi, kuas, sarung tangan — habis begitu dipakai.',
  EQUIPMENT: 'Timbangan, tang, cetakan — dipakai berulang.',
  OTHER: 'Keperluan kantor dan yang tidak masuk tiga kategori di atas.',
};

export const SUPPLY_CATEGORY_OPTIONS = SUPPLY_CATEGORIES.map((value) => ({
  value,
  label: SUPPLY_CATEGORY_LABELS[value],
}));
