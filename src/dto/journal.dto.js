import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for Journal Line Item (Non-SQL embedded array)
export const journalLineSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  accountCode: commonRules.coaAccountCode('Kode Akun'),
  accountName: commonRules.optionalString(),
  debit: commonRules.nonNegativeNumber('Debet').default(0),
  credit: commonRules.nonNegativeNumber('Kredit').default(0),
  description: commonRules.optionalString()
}).passthrough();

export const journalEntrySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  entryNumber: commonRules.nonEmptyString('Nomor Bukti Jurnal'),
  date: commonRules.dateString('Tanggal Jurnal'),
  description: commonRules.nonEmptyString('Keterangan Jurnal'),
  lines: z.array(journalLineSchema).min(2, 'Ayat jurnal minimal harus terdiri dari 2 baris (Debet & Kredit)').default([]),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultJournalEntry = {
  entryNumber: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  lines: [],
  createdAt: new Date().toISOString()
};

export const JournalEntryDTO = createDto(journalEntrySchema, defaultJournalEntry);
