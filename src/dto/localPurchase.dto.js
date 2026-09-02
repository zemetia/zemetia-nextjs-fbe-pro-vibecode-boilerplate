import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for payment history item in Local Purchase (Non-SQL embedded array)
const paymentHistoryItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  voucherNo: z.string().default(''),
  voucherType: z.string().default('CASH'),
  date: commonRules.dateString('Tanggal Pembayaran').default(() => new Date().toISOString().split('T')[0]),
  bank: z.string().default(''),
  amount: commonRules.nonNegativeNumber('Nominal Pembayaran').default(0),
  notes: z.string().default('')
}).passthrough();

export const localPurchaseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  receiptNo: commonRules.nonEmptyString('Nomor Kwitansi / Nota'),
  poNumber: commonRules.optionalString(),
  ttbNumber: commonRules.optionalString(),
  supplierName: commonRules.nonEmptyString('Nama Supplier / Tempat Beli'),
  orderDate: commonRules.dateString('Tanggal Transaksi'),
  itemCode: commonRules.nonEmptyString('Kode Barang Emas'),
  itemName: commonRules.nonEmptyString('Nama Barang Emas'),
  paymentMode: z.enum(['cash', 'credit']).default('cash'),
  paymentSourceAccount: commonRules.optionalString(),
  paymentSourceAccountName: commonRules.optionalString(),
  quantityGrams: commonRules.positiveNumber('Berat Emas (Gram)'),
  unitPriceIDR: commonRules.positiveNumber('Harga Satuan IDR per Gram'),
  totalAmount: commonRules.nonNegativeNumber('Total Nilai Transaksi IDR'),
  barCertificateNo: commonRules.optionalString(),
  barCountDetected: z.coerce.number().min(0).default(1),
  courierName: commonRules.optionalString(),
  courierDocNo: commonRules.optionalString(),
  pickupLocation: commonRules.optionalString(),
  ownerApprovedBy: commonRules.optionalString(),
  ownerApproved: z.boolean().default(true),
  warehouseName: commonRules.optionalString(),
  status: commonRules.optionalString(),
  isVaultReceived: z.boolean().default(false),
  paidAmountIDR: commonRules.nonNegativeNumber('Nominal Terbayar').default(0),
  remainingBalanceIDR: commonRules.nonNegativeNumber('Sisa Tagihan').default(0),
  paymentStatus: z.string().default('UNPAID'),
  paymentHistory: z.array(paymentHistoryItemSchema).default([]),
  prId: commonRules.optionalString(),
  prNumber: commonRules.optionalString(),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultLocalPurchase = {
  receiptNo: '',
  poNumber: '',
  ttbNumber: '',
  supplierName: '',
  orderDate: new Date().toISOString().split('T')[0],
  itemCode: '',
  itemName: '',
  paymentMode: 'cash',
  quantityGrams: 0,
  unitPriceIDR: 0,
  totalAmount: 0,
  barCertificateNo: '',
  barCountDetected: 1,
  courierName: '',
  courierDocNo: '',
  pickupLocation: '',
  ownerApprovedBy: 'Direktur Utama PT TAN',
  ownerApproved: true,
  warehouseName: 'Vault Utama PT TAN (Akun 1157)',
  status: 'IN TRANSIT',
  isVaultReceived: false,
  paidAmountIDR: 0,
  remainingBalanceIDR: 0,
  paymentStatus: 'UNPAID',
  paymentHistory: [],
  prId: '',
  prNumber: '',
  notes: '',
  createdAt: new Date().toISOString()
};

export const LocalPurchaseDTO = createDto(localPurchaseSchema, defaultLocalPurchase);
