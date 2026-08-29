import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Setiap aturan menyebut namanya sendiri: `handleApiError` membuang path Zod,
 * jadi pesannya adalah seluruh yang sampai ke pengguna
 * (docs/blueprint/ERROR_HANDLING.md).
 *
 * Yang sengaja **tidak** ada di sini: apa pun yang butuh baris dari basis data.
 * "Barangnya sudah nonaktif", "baris ini bukan milik kategori dokumennya",
 * "permintaannya sudah disetujui" dijaga di `src/lib/purchase-request-write.ts`,
 * karena payload sendirian tidak bisa menjawabnya.
 */

const CATEGORIES = ['GOLD_IMPORT', 'GOLD_LOCAL', 'SUPPLY'] as const;
const PRIORITIES = ['NORMAL', 'URGENT'] as const;
const STATUSES = ['DRAFT', 'APPROVED', 'VOID'] as const;
const WEIGHT_UNITS = ['GRAM', 'TROY_OUNCE'] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const MAX_QUANTITY = 1_000_000;
const MAX_ITEMS = 50;

const dateField = (label: string) =>
  z.string(`${label} wajib diisi`).regex(DATE_ONLY, `${label} tidak valid`);

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max.toLocaleString('id-ID')} karakter`)
    .optional();
}

/**
 * Satu baris. Dua kolom identitas keduanya opsional di sini dan **tepat satu**
 * yang harus terisi — mana yang berlaku ditentukan kategori dokumennya, dan
 * pemeriksaannya ada di write gateway yang memang tahu kategorinya.
 */
const itemSchema = z.object({
  product_id: z.string().trim().max(50, 'Barang yang dipilih tidak dikenali').optional(),
  supply_id: z.string().trim().max(50, 'Barang yang dipilih tidak dikenali').optional(),
  weight_unit: z.enum(WEIGHT_UNITS, 'Satuan berat tidak dikenali').optional(),
  quantity: z.coerce
    .number('Jumlah tidak valid')
    .positive('Jumlah harus lebih besar dari nol')
    .max(MAX_QUANTITY, 'Jumlah terlalu besar'),
  est_unit_price: z.coerce
    .number('Harga perkiraan tidak valid')
    .min(0, 'Harga perkiraan tidak boleh negatif')
    .max(1_000_000_000_000, 'Harga perkiraan terlalu besar'),
  notes: optionalText('Catatan baris', 200),
});

const purchaseRequestShape = {
  category: z.enum(CATEGORIES, 'Kategori permintaan tidak dikenali'),
  date: dateField('Tanggal permintaan'),
  required_date: z.string().regex(DATE_ONLY, 'Tanggal dibutuhkan tidak valid').optional(),
  department: z
    .string('Divisi peminta wajib diisi')
    .trim()
    .min(1, 'Divisi peminta wajib diisi')
    .max(100, 'Divisi peminta maksimal 100 karakter'),
  priority: z.enum(PRIORITIES, 'Prioritas tidak dikenali').optional(),
  suggested_partner_id: z.string().trim().max(50, 'Mitra yang dipilih tidak dikenali').optional(),
  currency_code: z
    .string('Mata uang wajib dipilih')
    .trim()
    .length(3, 'Kode mata uang harus 3 huruf')
    .optional(),
  notes: optionalText('Catatan', 500),
  items: z
    .array(itemSchema, 'Baris barang tidak valid')
    .min(1, 'Minimal satu baris barang harus diisi')
    .max(MAX_ITEMS, `Maksimal ${MAX_ITEMS} baris dalam satu permintaan`),
};

export const createPurchaseRequestSchema = z.object(purchaseRequestShape).refine(
  (value) => !value.required_date || value.required_date >= value.date,
  'Tanggal dibutuhkan tidak boleh lebih awal dari tanggal permintaan',
);

export const updatePurchaseRequestSchema = createPurchaseRequestSchema;

/**
 * Dua transisi satu pintu — statusnya sendiri yang jadi pembeda, dan tiap cabang
 * hanya membawa field yang dituntut transisinya.
 */
export const setPurchaseRequestStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('APPROVED') }),
  z.object({
    status: z.literal('VOID'),
    void_reason: z
      .string('Alasan pembatalan wajib diisi')
      .trim()
      .min(5, 'Alasan pembatalan minimal 5 karakter')
      .max(500, 'Alasan pembatalan maksimal 500 karakter'),
  }),
]);

export const purchaseRequestListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  status: z.enum(STATUSES, 'Filter status tidak dikenali').optional(),
  category: z.enum(CATEGORIES, 'Filter kategori tidak dikenali').optional(),
  priority: z.enum(PRIORITIES, 'Filter prioritas tidak dikenali').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;
export type SetPurchaseRequestStatusInput = z.infer<typeof setPurchaseRequestStatusSchema>;
export type PurchaseRequestListQuery = z.infer<typeof purchaseRequestListQuerySchema>;
