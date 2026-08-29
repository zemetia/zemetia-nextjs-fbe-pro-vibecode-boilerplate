import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Master barang non-logam. Setiap aturan menyebut namanya sendiri —
 * `handleApiError` membuang path Zod, jadi pesannya adalah seluruh yang sampai
 * ke pengguna (docs/blueprint/ERROR_HANDLING.md).
 */

const SUPPLY_CATEGORIES = ['CHEMICAL', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;

const supplyShape = {
  code: z
    .string('Kode barang wajib diisi')
    .trim()
    .min(1, 'Kode barang wajib diisi')
    .max(30, 'Kode barang maksimal 30 karakter'),
  name: z
    .string('Nama barang wajib diisi')
    .trim()
    .min(1, 'Nama barang wajib diisi')
    .max(150, 'Nama barang maksimal 150 karakter'),
  category: z.enum(SUPPLY_CATEGORIES, 'Kategori barang tidak dikenali').optional(),
  unit: z
    .string('Satuan beli wajib diisi')
    .trim()
    .min(1, 'Satuan beli wajib diisi')
    .max(30, 'Satuan beli maksimal 30 karakter'),
  last_price_idr: z.coerce
    .number('Harga terakhir tidak valid')
    .min(0, 'Harga terakhir tidak boleh negatif')
    .max(1_000_000_000_000, 'Harga terakhir terlalu besar')
    .optional(),
  notes: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional(),
};

export const createSupplySchema = z.object(supplyShape);
export const updateSupplySchema = createSupplySchema;

export const setSupplyStatusSchema = z.object({
  is_active: z.boolean('Status barang tidak dikenali'),
});

export const supplyListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  category: z.enum(SUPPLY_CATEGORIES, 'Filter kategori tidak dikenali').optional(),
  is_active: z
    .enum(['true', 'false'], 'Filter status tidak dikenali')
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type CreateSupplyInput = z.infer<typeof createSupplySchema>;
export type UpdateSupplyInput = z.infer<typeof updateSupplySchema>;
export type SetSupplyStatusInput = z.infer<typeof setSupplyStatusSchema>;
export type SupplyListQuery = z.infer<typeof supplyListQuerySchema>;
