import { z } from 'zod';

import { paginationSchema } from './common';

/** Rules for a TTB (penerimaan barang) decidable from the payload alone. */

const METAL_PURCHASE_DELIVERY_STATUSES = ['DRAFT', 'IN_TRANSIT', 'CONFIRMED', 'VOID'] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000_000_000;
const MAX_WEIGHT_GRAM = 1_000_000;
const MAX_LINES = 100;

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max.toLocaleString('id-ID')} karakter`)
    .optional()
    .transform((value) => (value ? value : null));
}

const idField = (label: string) =>
  z.string(`${label} wajib dipilih`).trim().min(1, `${label} wajib dipilih`).max(50);

const dateField = (label: string) =>
  z.string(`${label} wajib diisi`).regex(DATE_ONLY, `${label} tidak valid`);

const deliveryLineSchema = z.object({
  purchase_item_id: idField('Barang PO'),
  weight_gram: z.coerce
    .number('Berat wajib diisi')
    .positive('Berat harus lebih besar dari nol')
    .max(MAX_WEIGHT_GRAM, 'Berat terlalu besar'),
  purity_percent: z.coerce
    .number('Kadar wajib diisi')
    .positive('Kadar harus lebih besar dari nol')
    .max(100, 'Kadar maksimal 100 persen'),
  note: optionalText('Catatan baris', 300),
});

const deliveryChargeSchema = z.object({
  name: z.string('Nama biaya wajib diisi').trim().min(2, 'Nama biaya minimal 2 karakter').max(150),
  amount_idr: z.coerce
    .number('Nominal biaya wajib diisi')
    .positive('Nominal biaya harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nominal biaya melebihi batas yang wajar'),
});

const metalPurchaseDeliveryShape = {
  purchase_id: idField('Dokumen PO'),
  /** Override manual — kosong berarti digenerate server (`TTB-YYYYMM-XXXX`). */
  number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9/.\-]+$/, 'Nomor TTB hanya boleh huruf, angka, garis miring, titik, dan strip')
    .min(3, 'Nomor TTB minimal 3 karakter')
    .max(50, 'Nomor TTB maksimal 50 karakter')
    .optional()
    .transform((value) => (value ? value : undefined)),
  date: dateField('Tanggal penerimaan'),
  courier_partner_id: optionalText('Kurir', 50),
  tracking_number: optionalText('Nomor resi', 100),
  received_by_name: optionalText('Nama penerima', 150),
  cor_number: optionalText('Nomor COR', 100),
  supplier_do_number: optionalText('Nomor surat jalan', 100),
  /** Dokumen kepabeanan — hanya relevan untuk PO tipe IMPORT, tapi tidak dipaksa di sini. */
  pib_no: optionalText('Nomor PIB', 100),
  sppb_no: optionalText('Nomor SPPB', 100),
  mawb_no: optionalText('Nomor MAWB', 100),
  /** Nomor sertifikat/seri keping batangan, dipisah koma — lahir dari `CertificatesInput`. */
  bar_serial_numbers: optionalText('Nomor sertifikat/seri batangan', 2000),
  /** Nomor sertifikat assay kemurnian — dari lab uji kadar saat fisik tiba. */
  assay_certificate_no: optionalText('Nomor sertifikat assay', 100),
  /** Laci/slot brankas tujuan & nomor segel keamanan — input operator fisik saat TTB. */
  safe_box_slot: optionalText('Lokasi laci/slot brankas', 150),
  security_seal_no: optionalText('Nomor segel keamanan', 150),
  /** Berat menurut surat jalan supplier — pembanding hasil timbang ulang di baris. */
  document_weight_gram: z.coerce
    .number('Berat menurut surat jalan tidak valid')
    .positive('Berat menurut surat jalan harus lebih besar dari nol')
    .max(MAX_WEIGHT_GRAM, 'Berat terlalu besar')
    .optional(),
  lines: z
    .array(deliveryLineSchema, 'Barang yang diterima wajib diisi')
    .min(1, 'Penerimaan harus punya minimal satu barang')
    .max(MAX_LINES, `Barang maksimal ${MAX_LINES} baris`),
  charges: z.array(deliveryChargeSchema).max(MAX_LINES).optional().default([]),
  notes: optionalText('Catatan', 1000),
};

export const createMetalPurchaseDeliverySchema = z.object(metalPurchaseDeliveryShape);
export const updateMetalPurchaseDeliverySchema = createMetalPurchaseDeliverySchema;

export const voidMetalPurchaseDeliverySchema = z.object({
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

export const metalPurchaseDeliveryListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  purchase_id: z.string().trim().max(50, 'Filter PO tidak valid').optional(),
  status: z.enum(METAL_PURCHASE_DELIVERY_STATUSES, 'Filter status tidak dikenali').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export type CreateMetalPurchaseDeliveryInput = z.infer<typeof createMetalPurchaseDeliverySchema>;
export type UpdateMetalPurchaseDeliveryInput = z.infer<typeof updateMetalPurchaseDeliverySchema>;
export type VoidMetalPurchaseDeliveryInput = z.infer<typeof voidMetalPurchaseDeliverySchema>;
export type MetalPurchaseDeliveryListQuery = z.infer<typeof metalPurchaseDeliveryListQuerySchema>;
