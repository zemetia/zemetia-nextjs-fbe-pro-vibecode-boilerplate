import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Embedded Sub-Document for PR Line Item (Non-SQL)
const prItemSchema = z.object({
  itemId: commonRules.optionalString(),
  itemCode: commonRules.optionalString(),
  itemName: commonRules.nonEmptyString('Nama Item Pengadaan'),
  quantity: commonRules.positiveNumber('Jumlah Kuantitas Item').default(1),
  unit: z.string().default('g'),
  estimatedPrice: commonRules.nonNegativeNumber('Estimasi Harga Satuan').default(0),
  notes: commonRules.optionalString()
}).passthrough();

export const purchaseRequestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  prNumber: commonRules.nonEmptyString('Nomor Purchase Request (PR)'),
  category: z.enum(['GOLD_IMPORT', 'GOLD_LOCAL', 'LAB_CHEMICALS', 'GENERAL_SUPPLIES'], {
    error: 'Kategori pengadaan tidak valid'
  }).default('GOLD_IMPORT'),
  requestDate: commonRules.dateString('Tanggal Permintaan'),
  requiredDate: commonRules.dateString('Tanggal Dibutuhkan'),
  department: commonRules.nonEmptyString('Departemen Pengaju'),
  requesterName: commonRules.nonEmptyString('Nama Pemohon'),
  priority: z.enum(['Normal', 'Urgent']).default('Normal'),
  recommendedSupplier: commonRules.optionalString(),
  currency: z.string().default('IDR'),
  notes: commonRules.optionalString(),
  items: z.array(prItemSchema).min(1, 'Minimal harus terdapat 1 item pengadaan').default([]),
  status: z.string().default('PENDING_APPROVAL'),
  totalEstimatedAmountIDR: commonRules.nonNegativeNumber('Total Estimasi Anggaran').default(0),
  convertedPoNumber: commonRules.optionalString(),
  conversionDate: commonRules.optionalString(),
  convertedBy: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultPurchaseRequest = {
  prNumber: '',
  category: 'GOLD_IMPORT',
  requestDate: new Date().toISOString().split('T')[0],
  requiredDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
  department: 'Refinery & Lab QC',
  requesterName: '',
  priority: 'Normal',
  recommendedSupplier: '',
  currency: 'IDR',
  notes: '',
  items: [],
  status: 'PENDING_APPROVAL',
  totalEstimatedAmountIDR: 0,
  convertedPoNumber: '',
  conversionDate: '',
  convertedBy: '',
  createdAt: new Date().toISOString()
};

export const PurchaseRequestDTO = createDto(purchaseRequestSchema, defaultPurchaseRequest);
