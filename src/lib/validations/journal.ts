import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Jurnal umum manual.
 *
 * Yang **tidak** divalidasi di sini, dan itu disengaja: seimbangnya debit dan
 * kredit, akun daun, dan akun aktif. Ketiganya hidup di `src/lib/journal.ts`
 * karena keduanya harus berlaku sama untuk jurnal yang ditulis modul lain, yang
 * tidak pernah lewat skema ini. Menyalinnya ke sini hanya menghasilkan dua
 * kebenaran yang suatu hari berbeda.
 *
 * Yang dijaga di sini cuma bentuk kirimannya — sisanya urusan buku besar.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const JOURNAL_STATUSES = ['DRAFT', 'POSTED', 'VOID'] as const;
const JOURNAL_SOURCES = [
  'MANUAL',
  'PURCHASE',
  'SALES',
  'INVENTORY',
  'PRODUCTION',
  'BUYBACK',
  'PAYMENT',
  'ADJUSTMENT',
] as const;

/** Batas atas satu nilai baris — 18 digit dengan 2 desimal, sama dengan kolomnya. */
const MAX_AMOUNT = 9_999_999_999_999_999.99;

const amountSchema = z
  .number('Nilai harus berupa angka')
  .min(0, 'Nilai tidak boleh negatif')
  .max(MAX_AMOUNT, 'Nilai melebihi batas yang bisa disimpan')
  .default(0);

const journalLineSchema = z.object({
  account_id: z.string().trim().min(1, 'Akun pada baris jurnal wajib dipilih'),
  debit: amountSchema,
  credit: amountSchema,
  memo: z.string().trim().max(200, 'Keterangan baris maksimal 200 karakter').optional(),
});

const journalEntryShape = {
  date: z.string().regex(DATE_ONLY, 'Tanggal jurnal tidak valid'),
  description: z
    .string()
    .trim()
    .min(1, 'Keterangan jurnal wajib diisi')
    .max(300, 'Keterangan jurnal maksimal 300 karakter'),
  lines: z
    .array(journalLineSchema)
    .min(2, 'Jurnal harus punya minimal dua baris: satu debit dan satu kredit')
    .max(50, 'Satu jurnal maksimal 50 baris'),
};

export const createJournalEntrySchema = z.object(journalEntryShape);
export const updateJournalEntrySchema = z.object(journalEntryShape);

/**
 * Perpindahan status yang boleh diminta dari layar: draft → posting, dan
 * posting → batal. `DRAFT` tidak ada di sini — jurnal yang sudah masuk buku
 * tidak pernah turun kembali jadi draft, ia dibatalkan dan digantikan.
 */
export const journalEntryStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('POSTED') }),
  z.object({
    status: z.literal('VOID'),
    void_reason: z
      .string()
      .trim()
      .min(1, 'Alasan pembatalan wajib diisi')
      .max(300, 'Alasan pembatalan maksimal 300 karakter'),
  }),
]);

export const journalEntryListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  status: z.enum(JOURNAL_STATUSES, 'Filter status jurnal tidak dikenali').optional(),
  source: z.enum(JOURNAL_SOURCES, 'Filter sumber jurnal tidak dikenali').optional(),
  account_id: z.string().trim().max(50, 'Filter akun tidak valid').optional(),
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
});

export type CreateJournalEntryInputSchema = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInputSchema = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryStatusInput = z.infer<typeof journalEntryStatusSchema>;
export type JournalEntryListQuery = z.infer<typeof journalEntryListQuerySchema>;
