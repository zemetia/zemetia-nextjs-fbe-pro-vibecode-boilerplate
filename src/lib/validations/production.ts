import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Every rule names its own field: `handleApiError` drops the Zod path, so the
 * message is all the user gets (docs/blueprint/ERROR_HANDLING.md).
 *
 * What is deliberately *not* here: anything that needs a row from the database.
 * "Bahan ini tidak cukup", "SPK belum dirilis", "karat itu tidak terdaftar" are
 * enforced in `src/lib/production-write.ts`, because a payload alone cannot
 * answer them.
 */

const PRODUCTION_ORDER_STATUSES = ['DRAFT', 'RELEASED', 'CLOSED', 'VOID'] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const MAX_WEIGHT_GRAM = 1_000_000;

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max.toLocaleString('id-ID')} karakter`)
    .optional();
}

function weight(label: string) {
  return z.coerce
    .number(`${label} tidak valid`)
    .positive(`${label} harus lebih besar dari nol`)
    .max(MAX_WEIGHT_GRAM, `${label} terlalu besar`);
}

const idField = (label: string) =>
  z.string(`${label} wajib dipilih`).trim().min(1, `${label} wajib dipilih`).max(50);

const dateField = (label: string) => z.string(`${label} wajib diisi`).regex(DATE_ONLY, `${label} tidak valid`);

const karatField = z.coerce
  .number('Karat tidak valid')
  .int('Karat harus bilangan bulat')
  .min(1, 'Karat minimal 1')
  .max(24, 'Karat maksimal 24');

// ── SPK ──────────────────────────────────────────────────────────────────────

const productionOrderShape = {
  date: dateField('Tanggal SPK'),
  target_date: z.string().regex(DATE_ONLY, 'Target selesai tidak valid').optional(),
  model_name: optionalText('Model perhiasan', 100),
  karat: karatField,
  target_gross_weight_gram: weight('Berat kotor target'),
  target_piece_count: z.coerce
    .number('Jumlah keping tidak valid')
    .int('Jumlah keping harus bilangan bulat')
    .positive('Jumlah keping harus lebih besar dari nol')
    .optional(),
  location_name: optionalText('Lokasi produksi', 100),
  loss_tolerance_percent: z.coerce
    .number('Toleransi susut tidak valid')
    .min(0, 'Toleransi susut tidak boleh negatif')
    .max(100, 'Toleransi susut maksimal 100 persen')
    .optional(),
  notes: optionalText('Catatan', 500),
};

export const createProductionOrderSchema = z.object(productionOrderShape);
export const updateProductionOrderSchema = createProductionOrderSchema;

export const setProductionOrderStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('RELEASED') }),
  z.object({
    status: z.literal('CLOSED'),
    close_note: optionalText('Penjelasan susut', 500),
  }),
  z.object({
    status: z.literal('VOID'),
    void_reason: z
      .string('Alasan pembatalan wajib diisi')
      .trim()
      .min(5, 'Alasan pembatalan minimal 5 karakter')
      .max(500, 'Alasan pembatalan maksimal 500 karakter'),
  }),
]);

export const productionOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  status: z.enum(PRODUCTION_ORDER_STATUSES, 'Filter status tidak dikenali').optional(),
  model_name: z.string().trim().max(100, 'Filter model tidak valid').optional(),
  location_name: z.string().trim().max(100, 'Filter lokasi tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

// ── Pergerakan bahan ─────────────────────────────────────────────────────────

const materialLineSchema = z.object({
  lot_id: idField('Lot bahan'),
  gross_weight_gram: weight('Berat bahan'),
});

const materialLines = z
  .array(materialLineSchema, 'Baris bahan tidak valid')
  .min(1, 'Minimal satu lot bahan harus dipilih')
  .max(50, 'Maksimal 50 lot bahan dalam satu dokumen');

export const issueMaterialSchema = z.object({
  date: dateField('Tanggal pengeluaran'),
  source_location_id: idField('Lokasi asal bahan'),
  lines: materialLines,
  notes: optionalText('Catatan', 500),
});

export const returnMaterialSchema = z.object({
  date: dateField('Tanggal pengembalian'),
  destination_location_id: idField('Lokasi tujuan'),
  lines: materialLines,
  notes: optionalText('Catatan', 500),
});

// ── Hasil produksi ───────────────────────────────────────────────────────────

const jewelryOutputSchema = z.object({
  jewelry_model_id: idField('Model perhiasan hasil'),
  karat: karatField,
  piece_count: z.coerce
    .number('Jumlah keping tidak valid')
    .int('Jumlah keping harus bilangan bulat')
    .positive('Jumlah keping harus lebih besar dari nol'),
  /** Berat logamnya saja; batu punya fieldnya sendiri. */
  gross_weight_gram: weight('Berat perhiasan'),
  stone_weight_gram: z.coerce
    .number('Berat batu tidak valid')
    .min(0, 'Berat batu tidak boleh negatif')
    .max(MAX_WEIGHT_GRAM, 'Berat batu terlalu besar')
    .optional(),
  notes: optionalText('Catatan perhiasan', 200),
});

const scrapOutputSchema = z.object({
  gross_weight_gram: weight('Berat sisa'),
  purity_percent: z.coerce
    .number('Kadar sisa tidak valid')
    .positive('Kadar sisa harus lebih besar dari nol')
    .max(100, 'Kadar sisa maksimal 100 persen'),
  notes: optionalText('Catatan sisa', 200),
});

export const receiveProductionOutputSchema = z
  .object({
    date: dateField('Tanggal hasil'),
    consumption: materialLines,
    jewelry: z.array(jewelryOutputSchema).max(50, 'Maksimal 50 baris perhiasan').optional(),
    scrap: z.array(scrapOutputSchema).max(50, 'Maksimal 50 baris sisa').optional(),
    loss_fine_gram: z.coerce
      .number('Susut tidak valid')
      .min(0, 'Susut tidak boleh negatif')
      .max(MAX_WEIGHT_GRAM, 'Susut terlalu besar')
      .optional(),
    alloy_gram: z.coerce
      .number('Alloy tidak valid')
      .min(0, 'Alloy tidak boleh negatif')
      .max(MAX_WEIGHT_GRAM, 'Alloy terlalu besar')
      .optional(),
    notes: optionalText('Catatan', 500),
  })
  .superRefine((value, ctx) => {
    if ((value.jewelry?.length ?? 0) === 0 && (value.scrap?.length ?? 0) === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Catatan hasil harus punya minimal satu perhiasan atau satu sisa bahan.',
      });
    }
  });

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;
export type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>;
export type SetProductionOrderStatusInput = z.infer<typeof setProductionOrderStatusSchema>;
export type ProductionOrderListQuery = z.infer<typeof productionOrderListQuerySchema>;
export type IssueMaterialInputDTO = z.infer<typeof issueMaterialSchema>;
export type ReturnMaterialInputDTO = z.infer<typeof returnMaterialSchema>;
export type ReceiveProductionOutputInput = z.infer<typeof receiveProductionOutputSchema>;
