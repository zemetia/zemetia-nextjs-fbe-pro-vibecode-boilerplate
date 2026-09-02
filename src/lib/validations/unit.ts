import { z } from 'zod';

/**
 * Validasi Tipe Satuan & Satuan Pengukuran.
 * Setiap pesan kesalahan menyebut nama field-nya secara jelas.
 */

export const createUnitCategorySchema = z.object({
  code: z
    .string('Kode tipe satuan wajib diisi')
    .trim()
    .min(2, 'Kode tipe satuan minimal 2 karakter')
    .max(30, 'Kode tipe satuan maksimal 30 karakter')
    .toUpperCase(),
  name: z
    .string('Nama tipe satuan wajib diisi')
    .trim()
    .min(2, 'Nama tipe satuan minimal 2 karakter')
    .max(100, 'Nama tipe satuan maksimal 100 karakter'),
  description: z.string().trim().max(300, 'Keterangan maksimal 300 karakter').optional(),
});

export const updateUnitCategorySchema = createUnitCategorySchema;

export const createUnitSchema = z.object({
  code: z
    .string('Kode satuan wajib diisi')
    .trim()
    .min(1, 'Kode satuan wajib diisi')
    .max(20, 'Kode satuan maksimal 20 karakter')
    .toUpperCase(),
  name: z
    .string('Nama satuan wajib diisi')
    .trim()
    .min(1, 'Nama satuan wajib diisi')
    .max(100, 'Nama satuan maksimal 100 karakter'),
  symbol: z
    .string('Simbol satuan wajib diisi')
    .trim()
    .min(1, 'Simbol satuan wajib diisi')
    .max(15, 'Simbol satuan maksimal 15 karakter'),
  category_id: z.string('Kategori tipe satuan wajib dipilih').trim().min(1, 'Kategori tipe satuan wajib dipilih'),
  is_anchor: z.boolean('Penanda anchor tidak valid').default(false),
  conversion_factor: z.coerce
    .number('Faktor konversi tidak valid')
    .positive('Faktor konversi harus lebih besar dari 0')
    .max(1_000_000_000, 'Faktor konversi terlalu besar'),
  notes: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional(),
});

export const updateUnitSchema = createUnitSchema;

export const convertUnitQuerySchema = z.object({
  value: z.coerce.number('Nilai angka yang dikonversi wajib diisi').finite('Nilai angka tidak valid'),
  from_unit_code: z.string('Kode satuan asal wajib diisi').trim().min(1, 'Kode satuan asal wajib diisi'),
  to_unit_code: z.string('Kode satuan tujuan wajib diisi').trim().min(1, 'Kode satuan tujuan wajib diisi'),
});

export type CreateUnitCategoryInput = z.infer<typeof createUnitCategorySchema>;
export type UpdateUnitCategoryInput = z.infer<typeof updateUnitCategorySchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ConvertUnitQuery = z.infer<typeof convertUnitQuerySchema>;
