import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Rules for a metal purchase (PO/kuitansi) decidable from the payload alone.
 * What needs a row — partner aktif & berperan supplier, produk aktif — lives in
 * `metal-purchase-write.ts` (docs/blueprint/ERROR_HANDLING.md: setiap aturan
 * menyebut fieldnya sendiri, karena `handleApiError` membuang path Zod).
 */

const METAL_PURCHASE_TYPES = ['LOCAL', 'IMPORT'] as const;
const METAL_PURCHASE_PAYMENT_TYPES = ['PO', 'DP'] as const;
const METAL_PURCHASE_STATUSES = ['DRAFT', 'CONFIRMED', 'VOID'] as const;
const WEIGHT_UNITS = ['GRAM', 'TROY_OUNCE'] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000_000_000;
const MAX_WEIGHT_GRAM = 1_000_000;
const MAX_LINES = 100;

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max.toLocaleString('id-ID')} karakter`)
    .nullish()
    .transform((value) => (value ? value : null));
}

const idField = (label: string) =>
  z.string(`${label} wajib dipilih`).trim().min(1, `${label} wajib dipilih`).max(50);

const dateField = (label: string) =>
  z.string(`${label} wajib diisi`).regex(DATE_ONLY, `${label} tidak valid`);

const metalPurchaseItemSchema = z.object({
  product_id: idField('Produk'),
  weight_unit: z.enum(WEIGHT_UNITS, 'Satuan berat tidak dikenali').default('GRAM'),
  weight_gram: z.coerce
    .number('Berat wajib diisi')
    .positive('Berat harus lebih besar dari nol')
    .max(MAX_WEIGHT_GRAM, 'Berat terlalu besar'),
  purity_percent: z.coerce
    .number('Kadar wajib diisi')
    .positive('Kadar harus lebih besar dari nol')
    .max(100, 'Kadar maksimal 100 persen'),
  price_per_unit: z.coerce
    .number('Harga wajib diisi')
    .positive('Harga harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Harga melebihi batas yang wajar'),
  notes: optionalText('Catatan baris', 300),
});

const metalPurchaseChargeSchema = z.object({
  name: z.string('Nama biaya wajib diisi').trim().min(2, 'Nama biaya minimal 2 karakter').max(150),
  amount_idr: z.coerce
    .number('Nominal biaya wajib diisi')
    .positive('Nominal biaya harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nominal biaya melebihi batas yang wajar'),
});

const metalPurchaseShape = {
  type: z.enum(METAL_PURCHASE_TYPES, 'Jenis pembelian wajib dipilih'),
  payment_type: z.enum(METAL_PURCHASE_PAYMENT_TYPES, 'Cara pembayaran wajib dipilih'),
  partner_id: idField('Supplier'),
  date: dateField('Tanggal pembelian'),
  due_date: z
    .string()
    .regex(DATE_ONLY, 'Tanggal jatuh tempo tidak valid')
    .nullish()
    .transform((value) => value ?? null),
  supplier_invoice_number: optionalText('Nomor invoice supplier', 100),
  currency_code: z.string('Mata uang wajib diisi').trim().length(3, 'Kode mata uang tidak valid'),
  exchange_rate: z.coerce.number().positive().nullish().transform((value) => value ?? null),
  /// Dokumen kepabeanan & kargo — field impor. Opsional: nomornya lahir di
  /// pihak lain (bea cukai, maskapai) dan datang bertahap. (THIS.md 2026-08-18:
  /// di form TTB, tapi kolom di dokumen tetap ada untuk migrasi data & ETL.)
  pib_number:          optionalText('Nomor PIB', 100),
  sppb_number:         optionalText('Nomor SPPB', 100),
  mawb_number:         optionalText('Nomor MAWB', 100),
  courier_name:        optionalText('Nama kurir', 150),
  courier_mandate_number: optionalText('Nomor surat kuasa kurir', 100),
  /// Referensi Purchase Request asal (konversi PR → PO). Opsional: PO boleh
  /// lahir tanpa PR. Saat terisi, server mengunci PR-nya sebagai CONVERTED
  /// (mengisi convertedPoNumber/conversionDate/convertedBy) — cermin
  /// `markPRAsConverted` legacy.
  purchase_request_id: optionalText('Referensi PR', 50),
  items: z
    .array(metalPurchaseItemSchema, 'Barang wajib diisi')
    .min(1, 'Pembelian harus punya minimal satu barang')
    .max(MAX_LINES, `Barang maksimal ${MAX_LINES} baris`),
  charges: z.array(metalPurchaseChargeSchema).max(MAX_LINES).optional().default([]),
  notes: optionalText('Catatan', 1000),
};

export const createMetalPurchaseSchema = z.object(metalPurchaseShape).superRefine((value, ctx) => {
  if (value.currency_code !== 'IDR' && !value.exchange_rate) {
    ctx.addIssue({
      code: 'custom',
      path: ['exchange_rate'],
      message: 'Kurs wajib diisi untuk dokumen dalam mata uang selain rupiah.',
    });
  }
  if (value.currency_code === 'IDR' && value.exchange_rate) {
    ctx.addIssue({
      code: 'custom',
      path: ['exchange_rate'],
      message: 'Dokumen rupiah tidak memakai kurs — kosongkan.',
    });
  }
  if (value.due_date && value.due_date < value.date) {
    ctx.addIssue({
      code: 'custom',
      path: ['due_date'],
      message: 'Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pembelian.',
    });
  }
});

export const updateMetalPurchaseSchema = createMetalPurchaseSchema;

export const voidMetalPurchaseSchema = z.object({
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

export const metalPurchaseListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(METAL_PURCHASE_TYPES, 'Filter jenis tidak dikenali').optional(),
  payment_type: z.enum(METAL_PURCHASE_PAYMENT_TYPES, 'Filter cara pembayaran tidak dikenali').optional(),
  status: z.enum(METAL_PURCHASE_STATUSES, 'Filter status tidak dikenali').optional(),
  partner_id: z.string().trim().max(50, 'Filter supplier tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export type CreateMetalPurchaseInput = z.infer<typeof createMetalPurchaseSchema>;
export type UpdateMetalPurchaseInput = z.infer<typeof updateMetalPurchaseSchema>;
export type VoidMetalPurchaseInput = z.infer<typeof voidMetalPurchaseSchema>;
export type MetalPurchaseListQuery = z.infer<typeof metalPurchaseListQuerySchema>;
