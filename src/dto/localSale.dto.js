import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for embedded payment history in Local Sales
const salePaymentHistorySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  voucherNo: z.string().default(''),
  voucherType: z.string().default('CASH'),
  date: commonRules.dateString('Tanggal Pembayaran').default(() => new Date().toISOString().split('T')[0]),
  bank: z.string().default(''),
  amount: commonRules.nonNegativeNumber('Nominal Pembayaran').default(0),
  notes: z.string().default('')
}).passthrough();

// Embedded item for DO / Invoices
const localSaleItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  itemCode: commonRules.optionalString(),
  itemName: commonRules.nonEmptyString('Nama Barang Emas'),
  quantityGrams: commonRules.positiveNumber('Berat Barang (Gram)').default(1),
  unitPriceIDR: commonRules.nonNegativeNumber('Harga Satuan IDR').default(0),
  totalAmountIDR: commonRules.nonNegativeNumber('Total Harga IDR').default(0),
  barSerialNo: commonRules.optionalString(),
  notes: commonRules.optionalString()
}).passthrough();

export const localSaleSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  receiptNo: commonRules.nonEmptyString('Nomor Nota / Invoice Penjualan'),
  customerName: commonRules.nonEmptyString('Nama Pelanggan / Pembeli'),
  saleDate: commonRules.dateString('Tanggal Penjualan'),
  itemCode: commonRules.nonEmptyString('Kode Barang Emas'),
  itemName: commonRules.nonEmptyString('Nama Barang Emas'),
  sourceVault: commonRules.coaAccountCode('Akun Brankas Vault Asal'),
  sourceVaultName: commonRules.optionalString(),
  quantityGrams: commonRules.positiveNumber('Berat Emas Terjual (Gram)'),
  unitPriceIDR: commonRules.positiveNumber('Harga Jual Satuan per Gram'),
  totalAmount: commonRules.nonNegativeNumber('Total Nilai Penjualan IDR'),
  paymentMode: z.enum(['cash', 'credit', 'dp']).default('cash'),
  paidAmountIDR: commonRules.nonNegativeNumber('Nominal Diterima').default(0),
  remainingBalanceIDR: commonRules.nonNegativeNumber('Sisa Piutang').default(0),
  paymentStatus: z.string().default('PAID'),
  paymentHistory: z.array(salePaymentHistorySchema).default([]),
  barCertificateNo: commonRules.optionalString(),
  status: z.string().default('COMPLETED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultLocalSale = {
  receiptNo: '',
  customerName: '',
  saleDate: new Date().toISOString().split('T')[0],
  itemCode: '',
  itemName: '',
  sourceVault: '1157',
  sourceVaultName: 'Vault Utama Emas Murni (1157)',
  quantityGrams: 0,
  unitPriceIDR: 0,
  totalAmount: 0,
  paymentMode: 'cash',
  paidAmountIDR: 0,
  remainingBalanceIDR: 0,
  paymentStatus: 'PAID',
  paymentHistory: [],
  barCertificateNo: '',
  status: 'COMPLETED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const LocalSaleDTO = createDto(localSaleSchema, defaultLocalSale);

// Delivery Order (DO Lokal) Schema
export const localDeliveryOrderSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  doNumber: commonRules.nonEmptyString('Nomor Surat Jalan DO'),
  soNumber: commonRules.optionalString(),
  customerPONumber: commonRules.optionalString(),
  date: commonRules.dateString('Tanggal Pengeluaran Barang'),
  customerName: commonRules.nonEmptyString('Nama Penerima / Customer'),
  customerPhone: commonRules.optionalString(),
  customerAddress: commonRules.optionalString(),
  recipientAddress: commonRules.optionalString(),
  recipientName: commonRules.optionalString(),
  courierName: commonRules.nonEmptyString('Nama Kurir / Pengantar'),
  sourceVault: commonRules.coaAccountCode('Akun Brankas Asal'),
  sourceVaultName: commonRules.optionalString(),
  itemCode: commonRules.optionalString(),
  itemName: commonRules.optionalString(),
  items: z.array(localSaleItemSchema).default([]),
  netWeightGram: commonRules.nonNegativeNumber('Berat Bersih Gram').default(0),
  grossWeightGram: commonRules.nonNegativeNumber('Berat Kotor Gram').default(0),
  totalWeightGram: commonRules.nonNegativeNumber('Total Berat Emas (Gram)').default(0),
  barSerialNumbers: commonRules.optionalString(),
  securitySealNo: commonRules.optionalString(),
  sealNumber: commonRules.optionalString(),
  deliveryMethod: commonRules.optionalString(),
  boxCount: z.number().default(1),
  cogsAmountIDR: commonRules.nonNegativeNumber('HPP IDR').default(0),
  status: z.string().default('DELIVERED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultLocalDeliveryOrder = {
  doNumber: '',
  soNumber: '',
  customerPONumber: '',
  date: new Date().toISOString().split('T')[0],
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  recipientAddress: '',
  recipientName: '',
  courierName: '',
  sourceVault: '1157',
  sourceVaultName: 'Vault Utama Emas Murni (1157)',
  itemCode: '',
  itemName: '',
  items: [],
  netWeightGram: 0,
  grossWeightGram: 0,
  totalWeightGram: 0,
  barSerialNumbers: '',
  securitySealNo: '',
  sealNumber: '',
  deliveryMethod: 'KURIR_INTERNAL',
  boxCount: 1,
  cogsAmountIDR: 0,
  status: 'DELIVERED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const LocalDeliveryOrderDTO = createDto(localDeliveryOrderSchema, defaultLocalDeliveryOrder);

// Invoice Lokal Schema
export const localInvoiceSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  invoiceNumber: commonRules.nonEmptyString('Nomor Faktur Penjualan'),
  date: commonRules.dateString('Tanggal Faktur'),
  dueDate: commonRules.dateString('Tanggal Jatuh Tempo'),
  customerName: commonRules.nonEmptyString('Nama Pelanggan'),
  doReferenceNo: commonRules.optionalString(),
  items: z.array(localSaleItemSchema).default([]),
  subtotalAmount: commonRules.nonNegativeNumber('Subtotal IDR').default(0),
  dpAmount: commonRules.nonNegativeNumber('Potongan Uang Muka DP').default(0),
  totalAmount: commonRules.nonNegativeNumber('Total Tagihan IDR').default(0),
  paymentStatus: z.string().default('UNPAID'),
  status: z.string().default('POSTED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultLocalInvoice = {
  invoiceNumber: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: new Date().toISOString().split('T')[0],
  customerName: '',
  doReferenceNo: '',
  items: [],
  subtotalAmount: 0,
  dpAmount: 0,
  totalAmount: 0,
  paymentStatus: 'UNPAID',
  status: 'POSTED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const LocalInvoiceDTO = createDto(localInvoiceSchema, defaultLocalInvoice);
