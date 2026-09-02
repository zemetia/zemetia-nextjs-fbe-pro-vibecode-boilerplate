import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for embedded item line in Export documents
const exportItemLineSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  sku: commonRules.optionalString(),
  name: commonRules.nonEmptyString('Nama Perhiasan Ekspor'),
  karat: z.string().default('750'),
  purity: commonRules.nonNegativeNumber('Kadar Kemurnian %').default(75.0),
  quantityPcs: commonRules.positiveNumber('Jumlah Pcs').default(1),
  netWeightGram: commonRules.positiveNumber('Berat Bersih (Gram)').default(0),
  grossWeightGram: commonRules.nonNegativeNumber('Berat Kotor (Gram)').default(0),
  unitPriceUSD: commonRules.nonNegativeNumber('Harga Satuan USD').default(0),
  totalUSD: commonRules.nonNegativeNumber('Total USD').default(0),
  certificateNo: commonRules.optionalString()
}).passthrough();

// 1. Export Sales Order
export const exportSalesOrderSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  soNumber: commonRules.nonEmptyString('Nomor Sales Order Ekspor'),
  date: commonRules.dateString('Tanggal SO'),
  buyerName: commonRules.nonEmptyString('Nama Pembeli / Buyer Luar Negeri'),
  destinationCountry: commonRules.nonEmptyString('Negara Tujuan Ekspor'),
  customerPONumber: commonRules.optionalString(),
  currency: z.string().default('USD'),
  fixedGoldPriceUSDPerGram: commonRules.positiveNumber('Harga Emas Terkunci USD/Gram'),
  items: z.array(exportItemLineSchema).default([]),
  totalWeightGram: commonRules.positiveNumber('Total Berat Emas (Gram)'),
  totalAmountUSD: commonRules.positiveNumber('Total Nilai Pesanan USD'),
  status: z.string().default('CONFIRMED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultExportSalesOrder = {
  soNumber: '',
  date: new Date().toISOString().split('T')[0],
  buyerName: '',
  destinationCountry: 'United Arab Emirates (UAE)',
  customerPONumber: '',
  currency: 'USD',
  fixedGoldPriceUSDPerGram: 0,
  items: [],
  totalWeightGram: 0,
  totalAmountUSD: 0,
  status: 'CONFIRMED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const ExportSalesOrderDTO = createDto(exportSalesOrderSchema, defaultExportSalesOrder);

// 2. Export Commercial Invoice (Faktur Ekspor Komersial)
export const exportInvoiceSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  invoiceNumber: commonRules.nonEmptyString('Nomor Faktur Ekspor Komersial'),
  soNumber: commonRules.nonEmptyString('Nomor Referensi SO Ekspor'),
  date: commonRules.dateString('Tanggal Faktur'),
  dueDate: commonRules.dateString('Tanggal Jatuh Tempo'),
  buyerName: commonRules.nonEmptyString('Nama Pembeli Ekspor'),
  buyerAddress: commonRules.optionalString(),
  destinationCountry: commonRules.optionalString(),
  currency: z.string().default('USD'),
  exchangeRate: commonRules.positiveNumber('Kurs Konversi BCA e-Rate'),
  items: z.array(exportItemLineSchema).default([]),
  subtotalUSD: commonRules.nonNegativeNumber('Subtotal Nilai USD').default(0),
  totalAmountUSD: commonRules.positiveNumber('Total Faktur USD'),
  totalAmountIDR: commonRules.nonNegativeNumber('Total Nilai IDR').default(0),
  pebNumber: commonRules.optionalString(),
  awbNumber: commonRules.optionalString(),
  paymentTerms: commonRules.optionalString(),
  status: z.string().default('ISSUED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultExportInvoice = {
  invoiceNumber: '',
  soNumber: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: new Date().toISOString().split('T')[0],
  buyerName: '',
  buyerAddress: '',
  destinationCountry: 'United Arab Emirates (UAE)',
  currency: 'USD',
  exchangeRate: 16250,
  items: [],
  subtotalUSD: 0,
  totalAmountUSD: 0,
  totalAmountIDR: 0,
  pebNumber: '',
  awbNumber: '',
  paymentTerms: 'CAD / T/T Devisa',
  status: 'ISSUED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const ExportInvoiceDTO = createDto(exportInvoiceSchema, defaultExportInvoice);

// 3. Export Delivery Order (Surat Jalan & Packing List Ekspor)
export const exportDeliveryOrderSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  doNumber: commonRules.nonEmptyString('Nomor Surat Jalan Ekspor'),
  soNumber: commonRules.nonEmptyString('Nomor Referensi SO'),
  invoiceNumber: commonRules.optionalString(),
  date: commonRules.dateString('Tanggal Pengiriman Ekspor'),
  buyerName: commonRules.nonEmptyString('Nama Buyer Penerima'),
  destinationCountry: commonRules.optionalString(),
  items: z.array(exportItemLineSchema).default([]),
  netWeightGram: commonRules.positiveNumber('Berat Bersih Perhiasan Net (Gram)'),
  grossWeightGram: commonRules.positiveNumber('Berat Kotor Kemasan Gross (Gram)'),
  sealNumber: commonRules.nonEmptyString('Nomor Segel Keamanan Brankas'),
  carrierName: commonRules.nonEmptyString('Kargo Pengawal Bersenjata (Brinks/Malca-Amit)'),
  status: z.string().default('DISPATCHED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultExportDeliveryOrder = {
  doNumber: '',
  soNumber: '',
  invoiceNumber: '',
  date: new Date().toISOString().split('T')[0],
  buyerName: '',
  destinationCountry: 'United Arab Emirates (UAE)',
  items: [],
  netWeightGram: 0,
  grossWeightGram: 0,
  sealNumber: '',
  carrierName: 'BRINKS Global Services',
  status: 'DISPATCHED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const ExportDeliveryOrderDTO = createDto(exportDeliveryOrderSchema, defaultExportDeliveryOrder);
