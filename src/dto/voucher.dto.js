import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for embedded journal line in Voucher
const voucherJournalLineSchema = z.object({
  accountCode: commonRules.coaAccountCode('Kode Akun Jurnal'),
  accountName: commonRules.optionalString(),
  debit: commonRules.nonNegativeNumber('Debet').default(0),
  credit: commonRules.nonNegativeNumber('Kredit').default(0),
  description: commonRules.optionalString()
}).passthrough();

export const voucherSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  voucherNumber: commonRules.nonEmptyString('Nomor Voucher Kas/Bank'),
  voucherType: z.enum(['BBM', 'BBK', 'MEMORIAL', 'PAYMENT', 'RECEIPT'], {
    error: 'Tipe voucher harus BBM, BBK, atau Memorial'
  }).default('BBK'),
  date: commonRules.dateString('Tanggal Transaksi Voucher'),
  payeeOrPayer: commonRules.nonEmptyString('Penerima / Pembayar'),
  accountCode: commonRules.coaAccountCode('Akun Rekening Kas/Bank'),
  accountName: commonRules.optionalString(),
  amount: commonRules.positiveNumber('Nominal Transaksi Voucher'),
  paymentMethod: z.string().default('TRANSFER'),
  checkGiroNumber: commonRules.optionalString(),
  refDocType: commonRules.optionalString(),
  refDocNumber: commonRules.optionalString(),
  journalLines: z.array(voucherJournalLineSchema).default([]),
  status: z.string().default('POSTED'),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultVoucher = {
  voucherNumber: '',
  voucherType: 'BBK',
  date: new Date().toISOString().split('T')[0],
  payeeOrPayer: '',
  accountCode: '1111-IDR',
  accountName: 'Bank BCA IDR (Akun 1111-IDR)',
  amount: 0,
  paymentMethod: 'TRANSFER',
  checkGiroNumber: '',
  refDocType: '',
  refDocNumber: '',
  journalLines: [],
  status: 'POSTED',
  notes: '',
  createdAt: new Date().toISOString()
};

export const VoucherDTO = createDto(voucherSchema, defaultVoucher);
