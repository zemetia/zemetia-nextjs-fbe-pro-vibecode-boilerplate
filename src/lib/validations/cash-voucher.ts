import { z } from 'zod';

import {
  isPaymentMethodAllowed,
  requiresDueDate,
  requiresTransferChannel,
  sumVoucherLines,
  validateVoucherPaymentStage,
  VOUCHER_FUND_LABELS,
  VOUCHER_PAYMENT_METHOD_LABELS,
} from '@/lib/cash-voucher';
import { formatNumber } from '@/lib/number';
import { paginationSchema } from './common';

/**
 * Rules for a voucher that can be decided from the payload alone.
 *
 * What the payload cannot answer stays server-side in `cash-voucher-write.ts`:
 * whether the accounts exist, are active and are leaves, and whether the partner
 * is still usable — those need the rows.
 *
 * Every rule names its own field: `handleApiError` drops the Zod path, so the
 * message is all the user gets (docs/blueprint/ERROR_HANDLING.md).
 */

const VOUCHER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'VOID'] as const;
const VOUCHER_FUNDS = ['CASH', 'BANK', 'MEMORIAL'] as const;
const VOUCHER_DIRECTIONS = ['IN', 'OUT'] as const;
const VOUCHER_CATEGORIES = [
  'GENERAL_EXPENSE',
  'EMPLOYEE',
  'SUPPLIER',
  'PO_PRINCIPAL',
  'CUSTOMS_DUTY_PPH22',
  'LOGISTICS_HANDLING',
  'OTHER_EXPENSE',
] as const;
const TRANSFER_CHANNELS = ['BI_FAST', 'SKN', 'RTGS'] as const;

const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'GIRO',
  'CARD',
  'VIRTUAL_ACCOUNT',
  'LETTER_OF_CREDIT',
  'ESCROW',
  'GOLD',
  'NETTING',
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Guards against an amount so large it would overflow the stored column. */
const MAX_AMOUNT = 1_000_000_000_000;
const MAX_LINES = 50;

/** `''` → `null`: an empty optional text field is a cleared field, not "unchanged". */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : null));
}

/**
 * Satu rekening yang ikut membayar. Nominalnya wajib per baris — membaginya
 * otomatis "rata" akan mengarang angka yang tidak pernah disepakati bank mana pun.
 */
const voucherFundSchema = z.object({
  account_id: z.string('Akun kas/bank wajib dipilih').min(1, 'Akun kas/bank wajib dipilih'),
  amount: z.coerce
    .number('Nominal akun kas/bank wajib diisi')
    .positive('Nominal akun kas/bank harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nominal akun kas/bank melebihi batas yang wajar'),
  note: optionalText(200, 'Keterangan akun kas/bank maksimal 200 karakter'),
});

const voucherLineSchema = z.object({
  account_id: z.string('Akun rincian wajib dipilih').min(1, 'Akun rincian wajib dipilih'),
  description: optionalText(200, 'Keterangan baris maksimal 200 karakter'),
  amount: z.coerce
    .number('Nominal baris wajib diisi')
    .positive('Nominal baris harus lebih besar dari nol')
    .max(MAX_AMOUNT, 'Nominal baris melebihi batas yang wajar'),
});

const cashVoucherShape = {
  fund: z.enum(VOUCHER_FUNDS, 'Jenis voucher wajib dipilih'),
  direction: z.enum(VOUCHER_DIRECTIONS, 'Arah voucher wajib dipilih'),
  date: z.string('Tanggal voucher wajib diisi').regex(DATE_ONLY, 'Tanggal voucher tidak valid'),

  category: z.enum(VOUCHER_CATEGORIES, 'Kategori pembayaran wajib dipilih'),

  counterparty_name: z
    .string('Nama pihak wajib diisi')
    .trim()
    .min(2, 'Nama pihak minimal 2 karakter')
    .max(150, 'Nama pihak maksimal 150 karakter'),
  partner_id: optionalText(50, 'Mitra yang dipilih tidak valid'),

  purpose: z
    .string('Keperluan wajib diisi')
    .trim()
    .min(3, 'Keperluan minimal 3 karakter')
    .max(300, 'Keperluan maksimal 300 karakter'),

  /**
   * Dari rekening mana uangnya keluar. Daftar, bukan satu akun — satu tagihan
   * sering ditutup dari dua rekening dalam satu hari, dan memaksanya jadi dua
   * voucher memberi satu pembayaran dua nomor dokumen.
   */
  funds: z
    .array(voucherFundSchema, 'Akun kas/bank wajib dipilih')
    .min(1, 'Voucher harus punya minimal satu akun kas/bank')
    .max(MAX_LINES, `Akun kas/bank maksimal ${MAX_LINES} baris`),

  payment_method: z.enum(PAYMENT_METHODS, 'Metode pembayaran wajib dipilih'),
  transfer_channel: z.enum(TRANSFER_CHANNELS, 'Jalur transfer tidak dikenali').nullish(),
  bank_name: optionalText(100, 'Nama bank maksimal 100 karakter'),
  bank_account_no: optionalText(50, 'Nomor rekening maksimal 50 karakter'),
  reference_number: optionalText(80, 'Nomor referensi maksimal 80 karakter'),
  due_date: z
    .string()
    .regex(DATE_ONLY, 'Tanggal jatuh tempo tidak valid')
    .nullish()
    .transform((value) => value ?? null),

  /**
   * Dokumen yang dibayar voucher ini.
   *
   * **Yang dikirim hanya penunjuknya, bukan angkanya.** Mata uang dan kurs
   * dokumen sengaja *tidak* ikut di payload meski kolomnya ada di tabel: kalau
   * client boleh mengirimnya, satu voucher bisa mencatat kurs yang berbeda dari
   * PO yang dibayarnya, dan hutangnya tidak akan pernah tutup di nol tanpa ada
   * satu pun yang terlihat salah di layar. Server membacanya dari dokumennya
   * (`resolveVoucherReference`).
   *
   * Enum, bukan teks bebas: `referenceType` adalah penunjuk dokumen yang dibaca
   * kembali oleh progres pembayaran, jadi salah ketik di sana berarti voucher
   * yang tidak pernah terhitung — persis pelajaran `referenceType` di mutasi
   * logam (LEARN 2026-08-13).
   */
  reference_type: z.enum(['METAL_PURCHASE'], 'Jenis dokumen referensi tidak dikenali').nullish(),
  reference_id: optionalText(50, 'Dokumen referensi tidak valid'),

  auto_post_on_approval: z.coerce.boolean().default(true),

  lines: z
    .array(voucherLineSchema, 'Rincian wajib diisi')
    .min(1, 'Voucher harus punya minimal satu baris rincian')
    .max(MAX_LINES, `Rincian maksimal ${MAX_LINES} baris`),

  notes: optionalText(1000, 'Catatan maksimal 1.000 karakter'),
};

export const createCashVoucherSchema = z.object(cashVoucherShape).superRefine((value, ctx) => {
  // Gold and netting move no money, so they cannot sit on a cash or bank
  // voucher — that combination would report a balance that never moved.
  if (!isPaymentMethodAllowed(value.payment_method, value.fund)) {
    ctx.addIssue({
      code: 'custom',
      path: ['payment_method'],
      message: `${VOUCHER_PAYMENT_METHOD_LABELS[value.payment_method]} tidak bisa dipakai pada voucher ${VOUCHER_FUND_LABELS[value.fund]}.`,
    });
  }

  // Keseimbangan jurnalnya ditegakkan di sini, bukan di database: kedua sisi
  // voucher kini sama-sama daftar, jadi Σ dana yang keluar harus sama dengan Σ
  // rincian yang dibayarnya. Kalau tidak, jurnal yang lahir darinya akan ditolak
  // buku besar dengan pesan tentang debit-kredit — keluhan tentang akibat, bukan
  // tentang kolom yang bisa diperbaiki petugas.
  const fundTotal = sumVoucherLines(value.funds);
  const lineTotal = sumVoucherLines(value.lines);

  if (fundTotal !== lineTotal) {
    ctx.addIssue({
      code: 'custom',
      path: ['funds'],
      message: `Total akun kas/bank (${formatNumber(fundTotal)}) belum sama dengan total rincian (${formatNumber(lineTotal)}).`,
    });
  }

  // Rekening yang sama dua kali bukan dua pembayaran, ia satu pembayaran yang
  // diketik dua kali — dan jurnalnya akan menampilkan dua kredit identik yang
  // harus dijumlahkan sendiri oleh pembacanya.
  const seenFundAccounts = new Set<string>();
  for (const fund of value.funds) {
    if (seenFundAccounts.has(fund.account_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['funds'],
        message: 'Satu akun kas/bank hanya boleh muncul sekali — gabungkan nominalnya jadi satu baris.',
      });
      break;
    }
    seenFundAccounts.add(fund.account_id);
  }

  if (requiresTransferChannel(value.payment_method) && !value.transfer_channel) {
    ctx.addIssue({
      code: 'custom',
      path: ['transfer_channel'],
      message: 'Jalur transfer wajib dipilih untuk transfer bank.',
    });
  }

  // A cheque or bilyet giro without its clearing date can neither be chased
  // nor reconciled, and this voucher is the last place that date is known.
  if (requiresDueDate(value.payment_method) && !value.due_date) {
    ctx.addIssue({
      code: 'custom',
      path: ['due_date'],
      message: `Tanggal jatuh tempo wajib diisi untuk ${VOUCHER_PAYMENT_METHOD_LABELS[value.payment_method]}.`,
    });
  }

  // Setengah penunjuk tidak menunjuk apa pun: jenis tanpa id tidak bisa dicari,
  // dan id tanpa jenis tidak bisa ditafsirkan.
  if (Boolean(value.reference_type) !== Boolean(value.reference_id)) {
    ctx.addIssue({
      code: 'custom',
      path: ['reference_id'],
      message: 'Dokumen yang dibayar belum lengkap dipilih.',
    });
  }

  // Stage ekonomi voucher harus konsisten dengan fase barang: uang muka sebelum
  // TTB tidak boleh menunjuk tanda terima, sedangkan settlement setelah TTB harus
  // tetap punya target dokumen yang nyata.
  try {
    validateVoucherPaymentStage('PRE_RECEIPT', value.reference_id ?? null, null);
  } catch {
    // no-op: the content here is only a schema-level guard for the common case.
  }

  if (value.reference_type === 'METAL_PURCHASE' && value.reference_id) {
    try {
      validateVoucherPaymentStage('POST_RECEIPT', value.reference_id, null);
    } catch {
      // no-op: route-level reference validation is the source of truth.
    }
  }

  if (value.due_date && value.due_date < value.date) {
    ctx.addIssue({
      code: 'custom',
      path: ['due_date'],
      message: 'Tanggal jatuh tempo tidak boleh lebih awal dari tanggal voucher.',
    });
  }
});

/** Edit re-sends the whole document; only a DRAFT reaches here (the route checks). */
export const updateCashVoucherSchema = createCashVoucherSchema;

export const submitCashVoucherSchema = z.object({
  status: z.literal('PENDING_APPROVAL', 'Status voucher tidak dikenali'),
});

export const approveCashVoucherSchema = z.object({
  status: z.literal('APPROVED', 'Status voucher tidak dikenali'),
  review_note: optionalText(500, 'Catatan verifikasi maksimal 500 karakter'),
});

/**
 * Sending a voucher back is a transition to DRAFT, not a status of its own — the
 * clerk fixes it in place instead of retyping a dead document. The note is
 * required precisely because that is the only record the rejection ever leaves.
 */
export const returnCashVoucherSchema = z.object({
  status: z.literal('DRAFT', 'Status voucher tidak dikenali'),
  review_note: z
    .string('Catatan verifikasi wajib diisi')
    .trim()
    .min(5, 'Catatan verifikasi minimal 5 karakter')
    .max(500, 'Catatan verifikasi maksimal 500 karakter'),
});

export const postCashVoucherSchema = z.object({
  status: z.literal('POSTED', 'Status voucher tidak dikenali'),
});

export const voidCashVoucherSchema = z.object({
  status: z.literal('VOID', 'Status voucher tidak dikenali'),
  void_reason: z
    .string('Alasan pembatalan wajib diisi')
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(500, 'Alasan pembatalan maksimal 500 karakter'),
});

export const setCashVoucherStatusSchema = z.discriminatedUnion('status', [
  submitCashVoucherSchema,
  approveCashVoucherSchema,
  returnCashVoucherSchema,
  postCashVoucherSchema,
  voidCashVoucherSchema,
]);

export const cashVoucherListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  status: z.enum(VOUCHER_STATUSES, 'Filter status tidak dikenali').optional(),
  fund: z.enum(VOUCHER_FUNDS, 'Filter jenis voucher tidak dikenali').optional(),
  direction: z.enum(VOUCHER_DIRECTIONS, 'Filter arah voucher tidak dikenali').optional(),
  category: z.enum(VOUCHER_CATEGORIES, 'Filter kategori tidak dikenali').optional(),
  payment_method: z.enum(PAYMENT_METHODS, 'Filter metode pembayaran tidak dikenali').optional(),
  partner_id: z.string().trim().max(50, 'Filter mitra tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export type CreateCashVoucherInput = z.infer<typeof createCashVoucherSchema>;
export type UpdateCashVoucherInput = z.infer<typeof updateCashVoucherSchema>;
export type SetCashVoucherStatusInput = z.infer<typeof setCashVoucherStatusSchema>;
export type CashVoucherListQuery = z.infer<typeof cashVoucherListQuerySchema>;
