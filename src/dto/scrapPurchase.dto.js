import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

export const scrapPurchaseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  receiptNo: commonRules.nonEmptyString('Nomor Nota Pembelian Scrap'),
  spkMeltingNo: commonRules.optionalString(),
  date: commonRules.dateString('Tanggal Pembelian'),
  supplierName: commonRules.nonEmptyString('Nama Supplier / Toko Emas'),
  itemDescription: commonRules.nonEmptyString('Deskripsi Barang Scrap'),
  grossWeight: commonRules.positiveNumber('Berat Kotor Gross (Gram)'),
  xrfPurity: commonRules.percentageNumber('Kadar Kemurnian XRF (%)'),
  estimatedFineGold: commonRules.positiveNumber('Estimasi Fine Gold (Gram)'),
  pricePerFineGram: commonRules.positiveNumber('Harga Satuan per Gram Fine Gold'),
  totalAmount: commonRules.nonNegativeNumber('Total Nilai Pembelian IDR'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'HUTANG']).default('CASH'),
  creditAccount: commonRules.coaAccountCode('Akun Sumber Pembayaran'),
  creditAccountName: commonRules.optionalString(),
  targetVault: commonRules.coaAccountCode('Akun Brankas Vault Tujuan'),
  targetVaultName: commonRules.optionalString(),
  status: z.string().default('RECEIVED & STORED IN SCRAP VAULT'),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultScrapPurchase = {
  receiptNo: '',
  spkMeltingNo: '',
  date: new Date().toISOString().split('T')[0],
  supplierName: '',
  itemDescription: 'Pecahan Perhiasan Emas Bekas Karat Campur',
  grossWeight: 0,
  xrfPurity: 0,
  estimatedFineGold: 0,
  pricePerFineGram: 0,
  totalAmount: 0,
  paymentMethod: 'CASH',
  creditAccount: '1110',
  creditAccountName: 'Kas Kecil (Petty Cash)',
  targetVault: '1152',
  targetVaultName: 'Vault Pecahan Scrap & Leburan (Akun 1152)',
  status: 'RECEIVED & STORED IN SCRAP VAULT',
  createdAt: new Date().toISOString()
};

export const ScrapPurchaseDTO = createDto(scrapPurchaseSchema, defaultScrapPurchase);
