import { zodFieldErrors, type FieldErrors } from '@/hooks';
import { fromDateOnly, toDateOnly, today } from '@/lib/date';
import { roundTo } from '@/lib/number';
import { JOURNAL_MONEY_SCALE } from '@/lib/journal-entry';
import { createJournalEntrySchema } from '@/lib/validations';
import type { JournalEntryWritePayload } from '@/services';
import type { JournalEntryDetailVO } from '@/types/value-objects';

/**
 * State form jurnal manual.
 *
 * Nilainya `number | undefined`, tidak pernah `0`, supaya `<NumberInput />`
 * menampilkan kolom kosong dan bukan nol yang harus dihapus dulu — dan supaya
 * "belum diisi" bisa dibedakan dari "diisi nol", dua hal yang di jurnal punya
 * akibat berbeda.
 */

export interface JournalLineState {
  /** Identitas baris di sisi klien. Tidak pernah dikirim — server yang menomori. */
  key: string;
  accountId: string;
  debit: number | undefined;
  credit: number | undefined;
  memo: string;
}

export interface JournalFormState {
  date: Date | undefined;
  description: string;
  lines: JournalLineState[];
}

let lineCounter = 0;

export function newLine(): JournalLineState {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, accountId: '', debit: undefined, credit: undefined, memo: '' };
}

/**
 * Form kosong lahir dengan **dua** baris, bukan satu.
 *
 * Jurnal yang sah paling sedikit punya satu debit dan satu kredit, jadi baris
 * kedua bukan kemurahan hati — ia bentuk minimum dokumennya, dan menampilkannya
 * sejak awal membuat bentuk itu terlihat sebelum ada yang mengetik.
 */
export function emptyForm(): JournalFormState {
  return { date: today(), description: '', lines: [newLine(), newLine()] };
}

export function formFromEntry(entry: JournalEntryDetailVO): JournalFormState {
  return {
    date: fromDateOnly(entry.date),
    description: entry.description,
    lines: entry.lines.map((line) => ({
      key: `line-${line.id}`,
      accountId: line.accountId,
      debit: line.debit > 0 ? line.debit : undefined,
      credit: line.creditValue > 0 ? line.creditValue : undefined,
      memo: line.memo === '—' ? '' : line.memo,
    })),
  };
}

export function sumSide(lines: readonly JournalLineState[], side: 'debit' | 'credit'): number {
  return roundTo(
    lines.reduce((total, line) => total + (line[side] ?? 0), 0),
    JOURNAL_MONEY_SCALE,
  );
}

/**
 * Selisih debit dan kredit. Nol berarti seimbang — dan itu satu-satunya keadaan
 * yang boleh dikirim, karena `createJournalEntry` menolak sisanya dengan pesan
 * yang baru terbaca setelah petugas menekan simpan.
 */
export function imbalance(lines: readonly JournalLineState[]): number {
  return roundTo(sumSide(lines, 'debit') - sumSide(lines, 'credit'), JOURNAL_MONEY_SCALE);
}

/**
 * Pemeriksaan yang bisa dijawab tanpa jaringan: bentuk kiriman menurut skema
 * Zod-nya, ditambah dua aturan yang skema itu **sengaja** tidak punya.
 *
 * Seimbangnya debit dan kredit hidup di `src/lib/journal.ts`, bukan di skema,
 * karena ia harus berlaku sama untuk jurnal yang ditulis modul lain yang tidak
 * pernah lewat skema itu. Konsekuensinya: layar harus mengeceknya sendiri, kalau
 * tidak petugas baru tahu jurnalnya timpang setelah menekan simpan.
 *
 * Yang **tidak** dicek di sini: akun daun dan akun aktif. Keduanya hanya bisa
 * dijawab oleh bagan akun yang sedang berlaku, dan `AccountPicker` sudah
 * menyaringnya dari daftar pilihan.
 */
export function fieldErrors(state: JournalFormState): FieldErrors {
  const payload = toPayload(state);
  const errors: FieldErrors = { ...zodFieldErrors(createJournalEntrySchema, payload) };

  if (errors.lines === undefined) {
    if (payload.lines.length < state.lines.filter((line) => line.accountId !== '').length) {
      errors.lines = 'Masih ada baris yang sudah dipilih akunnya tapi belum diisi nilainya';
    } else if (imbalance(state.lines) !== 0) {
      errors.lines = 'Total debit dan total kredit harus sama persis';
    }
  }

  return errors;
}

/**
 * Baris yang benar-benar dikirim: yang kosong sama sekali dibuang di sini, bukan
 * ditolak. Baris sisa dari menambah lalu berubah pikiran adalah hal biasa saat
 * mengetik, dan menolak dokumen karenanya hanya memindahkan pekerjaan merapikan
 * ke petugasnya.
 */
export function toPayload(state: JournalFormState): JournalEntryWritePayload {
  return {
    date: toDateOnly(state.date ?? today()),
    description: state.description.trim(),
    lines: state.lines
      .filter((line) => line.accountId !== '' && ((line.debit ?? 0) > 0 || (line.credit ?? 0) > 0))
      .map((line) => ({
        account_id: line.accountId,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        ...(line.memo.trim() === '' ? {} : { memo: line.memo.trim() }),
      })),
  };
}
