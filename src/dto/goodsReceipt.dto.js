import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// TTB tidak menyimpan supplier, brankas tujuan, deskripsi barang, harga satuan,
// dan total valuasi. Semuanya diturunkan dari dokumen PO acuan lewat `poNumber`
// (lihat resolveGoodsReceiptPO di storageService) — PO adalah satu-satunya sumber kebenaran.
export const goodsReceiptSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  grnNumber: commonRules.nonEmptyString('Nomor TTB / GRN'),
  poNumber: commonRules.nonEmptyString('Nomor Purchase Order (PO) Acuan'),
  supplierDoNumber: z.string().nullish().transform(val => (!val || !String(val).trim() ? 'SJ-DIRECT' : String(val).trim())),
  date: commonRules.dateString('Tanggal Penerimaan Fisik'),
  barSerialNumbers: commonRules.optionalString(),
  certificates: z.array(z.any()).optional().default([]),
  assayCertificateNo: commonRules.optionalString(),
  receivedWeightGram: commonRules.positiveNumber('Berat Bersih Diterima (Gram)'),
  pibNo: commonRules.optionalString(),
  sppbNo: commonRules.optionalString(),
  mawbNo: commonRules.optionalString(),
  status: z.string().default('RECEIVED & VERIFIED'),
  // Siapa yang menerima barangnya di meja kita. `receivedByUserId` adalah id user
  // yang login saat TTB disimpan — padanan kolom `receivedById` di tabel
  // MetalPurchaseDelivery. Namanya ikut disimpan supaya register lama tetap
  // terbaca walau user-nya kelak dinonaktifkan.
  receivedByUserId: commonRules.optionalString(),
  receivedByName: commonRules.optionalString(),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultGoodsReceipt = {
  grnNumber: '',
  poNumber: '',
  supplierDoNumber: 'SJ-DIRECT',
  date: new Date().toISOString().split('T')[0],
  barSerialNumbers: '',
  certificates: [],
  assayCertificateNo: '',
  receivedWeightGram: 0,
  pibNo: '',
  sppbNo: '',
  mawbNo: '',
  status: 'RECEIVED & VERIFIED',
  receivedByUserId: '',
  receivedByName: '',
  notes: '',
  createdAt: new Date().toISOString()
};

export const GoodsReceiptDTO = createDto(goodsReceiptSchema, defaultGoodsReceipt);
