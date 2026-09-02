import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Rules for a sales order (SO/kuitansi) decidable from the payload alone.
 * What needs a row — customer aktif & berperan customer, produk aktif, lot
 * tersedia — lives in `sales-write.ts`.
 */

const SALES_TYPES = ['EXPORT', 'LOCAL'] as const;
const SALES_PAYMENT_TYPES = ['PO', 'DP'] as const;
const SALES_STATUSES = ['DRAFT', 'CONFIRMED', 'VOID'] as const;
const SALES_DELIVERY_METHODS = ['COUNTER', 'KURIR_INTERNAL', 'EXPEDITION'] as const;
const SALES_INVOICE_PAYMENT_MODES = ['CASH', 'CREDIT', 'DP'] as const;
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
    .optional()
    .transform((value) => (value ? value : null));
}

const idField = (label: string) =>
  z.string(`${label} wajib dipilih`).trim().min(1, `${label} wajib dipilih`).max(50);

const dateField = (label: string) =>
  z.string(`${label} wajib diisi`).regex(DATE_ONLY, `${label} tidak valid`);

const salesOrderItemSchema = z.object({
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

const salesOrderShape = {
  type: z.enum(SALES_TYPES, 'Jenis penjualan wajib dipilih'),
  payment_type: z.enum(SALES_PAYMENT_TYPES, 'Cara pembayaran wajib dipilih'),
  partner_id: idField('Customer'),
  date: dateField('Tanggal penjualan'),
  due_date: z
    .string()
    .regex(DATE_ONLY, 'Tanggal jatuh tempo tidak valid')
    .nullish()
    .transform((value) => value ?? null),
  customer_po_number: optionalText('Nomor PO customer', 100),
  currency_code: z.string('Mata uang wajib diisi').trim().length(3, 'Kode mata uang tidak valid'),
  exchange_rate: z.coerce.number().positive().nullish().transform((value) => value ?? null),
  items: z
    .array(salesOrderItemSchema, 'Barang wajib diisi')
    .min(1, 'Penjualan harus punya minimal satu barang')
    .max(MAX_LINES, `Barang maksimal ${MAX_LINES} baris`),
  notes: optionalText('Catatan', 1000),
};

export const createSalesOrderSchema = z.object(salesOrderShape).superRefine((value, ctx) => {
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
      message: 'Tanggal jatuh tempo tidak boleh lebih awal dari tanggal penjualan.',
    });
  }
});

export const updateSalesOrderSchema = createSalesOrderSchema;

export const voidSalesOrderSchema = z.object({
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

export const salesOrderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(SALES_TYPES, 'Filter jenis tidak dikenali').optional(),
  payment_type: z.enum(SALES_PAYMENT_TYPES, 'Filter cara pembayaran tidak dikenali').optional(),
  status: z.enum(SALES_STATUSES, 'Filter status tidak dikenali').optional(),
  partner_id: z.string().trim().max(50, 'Filter customer tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

// ── Surat Jalan ──────────────────────────────────────────────────────────────

const salesDeliveryLineSchema = z.object({
  order_item_id: idField('Baris order'),
  lot_id: idField('Lot'),
  location_id: idField('Lokasi'),
  piece_count: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
  gross_weight_gram: z.coerce
    .number('Berat wajib diisi')
    .positive('Berat harus lebih besar dari nol')
    .max(MAX_WEIGHT_GRAM, 'Berat terlalu besar'),
  purity_percent: z.coerce
    .number('Kadar wajib diisi')
    .positive('Kadar harus lebih besar dari nol')
    .max(100, 'Kadar maksimal 100 persen'),
  note: optionalText('Catatan baris', 300),
});

const salesDeliveryChargeSchema = z.object({
  name: z.string('Nama biaya wajib diisi').trim().min(2, 'Nama biaya minimal 2 karakter').max(150),
  amount_idr: z.coerce
    .number('Nominal biaya wajib diisi')
    .positive('Nominal biaya harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nominal biaya melebihi batas yang wajar'),
});

export const createSalesDeliverySchema = z.object({
  type: z.enum(SALES_TYPES, 'Jenis penjualan wajib dipilih'),
  order_id: idField('Sales order'),
  date: dateField('Tanggal pengiriman'),
  recipient_name: optionalText('Nama penerima', 150),
  delivery_method: z.enum(SALES_DELIVERY_METHODS, 'Cara pengiriman tidak dikenali').default('COUNTER'),
  courier_name: optionalText('Nama kurir', 150),
  carrier_name: optionalText('Kargo pengawal', 150),
  awb_number: optionalText('Nomor AWB', 100),
  peb_number: optionalText('Nomor PEB', 100),
  seal_number: optionalText('Nomor segel', 100),
  box_count: z.coerce.number().int().positive().max(10_000).optional(),
  gold_certificate_no: optionalText('Nomor sertifikat emas', 100),
  purity_certificate_no: optionalText('Nomor sertifikat kadar', 100),
  lines: z
    .array(salesDeliveryLineSchema, 'Barang wajib diisi')
    .min(1, 'Surat jalan harus punya minimal satu baris')
    .max(MAX_LINES, `Barang maksimal ${MAX_LINES} baris`),
  charges: z.array(salesDeliveryChargeSchema).max(MAX_LINES).optional().default([]),
  notes: optionalText('Catatan', 1000),
});

export const salesDeliveryListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(SALES_TYPES, 'Filter jenis tidak dikenali').optional(),
  status: z.enum(SALES_STATUSES, 'Filter status tidak dikenali').optional(),
  order_id: z.string().trim().max(50, 'Filter sales order tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export const voidSalesDeliverySchema = z.object({
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

// ── Faktur ───────────────────────────────────────────────────────────────────

const salesInvoiceItemSchema = z.object({
  order_item_id: idField('Baris order'),
  weight_gram: z.coerce
    .number('Berat wajib diisi')
    .positive('Berat harus lebih besar dari nol')
    .max(MAX_WEIGHT_GRAM, 'Berat terlalu besar'),
  amount: z.coerce
    .number('Nilai wajib diisi')
    .positive('Nilai harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nilai melebihi batas yang wajar'),
});

export const createSalesInvoiceSchema = z.object({
  type: z.enum(SALES_TYPES, 'Jenis penjualan wajib dipilih'),
  order_id: idField('Sales order'),
  date: dateField('Tanggal faktur'),
  due_date: z
    .string()
    .regex(DATE_ONLY, 'Tanggal jatuh tempo tidak valid')
    .nullish()
    .transform((value) => value ?? null),
  currency_code: z.string('Mata uang wajib diisi').trim().length(3, 'Kode mata uang tidak valid'),
  exchange_rate: z.coerce.number().positive().nullish().transform((value) => value ?? null),
  subtotal_amount: z.coerce
    .number('Nilai tagihan wajib diisi')
    .nonnegative('Nilai tagihan tidak boleh negatif')
    .max(MAX_AMOUNT, 'Nilai melebihi batas yang wajar'),
  dp_amount: z.coerce.number().nonnegative().max(MAX_AMOUNT).optional().default(0),
  total_amount: z.coerce
    .number('Total wajib diisi')
    .nonnegative('Total tidak boleh negatif')
    .max(MAX_AMOUNT, 'Nilai melebihi batas yang wajar'),
  tax_facility: optionalText('Fasilitas pajak', 150),
  tax_amount_idr: z.coerce.number().nonnegative().nullish().transform((value) => value ?? null),
  payment_mode: z.enum(SALES_INVOICE_PAYMENT_MODES, 'Cara bayar tidak dikenali').default('CASH'),
  dhe_bca_account: optionalText('Rekening devisa (DHE)', 50),
  peb_number: optionalText('Nomor PEB', 100),
  awb_number: optionalText('Nomor AWB', 100),
  items: z
    .array(salesInvoiceItemSchema, 'Barang wajib diisi')
    .min(1, 'Faktur harus punya minimal satu baris')
    .max(MAX_LINES, `Barang maksimal ${MAX_LINES} baris`),
  notes: optionalText('Catatan', 1000),
}).superRefine((value, ctx) => {
  if (value.currency_code !== 'IDR' && !value.exchange_rate) {
    ctx.addIssue({
      code: 'custom',
      path: ['exchange_rate'],
      message: 'Kurs wajib diisi untuk faktur dalam mata uang selain rupiah.',
    });
  }
  if (value.dp_amount > value.subtotal_amount) {
    ctx.addIssue({
      code: 'custom',
      path: ['dp_amount'],
      message: 'Uang muka tidak boleh melebihi nilai tagihan.',
    });
  }
});

export const salesInvoiceListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(SALES_TYPES, 'Filter jenis tidak dikenali').optional(),
  status: z.enum(['DRAFT', 'POSTED', 'VOID'], 'Filter status tidak dikenali').optional(),
  payment_status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID'], 'Filter status bayar tidak dikenali').optional(),
  order_id: z.string().trim().max(50, 'Filter sales order tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export const voidSalesInvoiceSchema = z.object({
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type VoidSalesOrderInput = z.infer<typeof voidSalesOrderSchema>;
export type SalesOrderListQuery = z.infer<typeof salesOrderListQuerySchema>;
export type CreateSalesDeliveryInput = z.infer<typeof createSalesDeliverySchema>;
export type VoidSalesDeliveryInput = z.infer<typeof voidSalesDeliverySchema>;
export type SalesDeliveryListQuery = z.infer<typeof salesDeliveryListQuerySchema>;
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type VoidSalesInvoiceInput = z.infer<typeof voidSalesInvoiceSchema>;
export type SalesInvoiceListQuery = z.infer<typeof salesInvoiceListQuerySchema>;
