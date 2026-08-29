import type { JournalSource, JournalStatus } from '@prisma/client';

/**
 * Label dan aturan tampilan jurnal umum. Database menyimpan pengenal Inggris;
 * seluruh teks yang sampai ke layar berasal dari sini — bukan dari ternary di
 * dalam komponen.
 *
 * `MANUAL` sengaja berdiri sendiri di daftar sumber: ia satu-satunya yang boleh
 * dibuat, diubah, dan dihapus lewat layar jurnal. Jurnal bersumber modul lain
 * adalah cerminan dokumennya — mengubahnya dari sini akan membuat buku dan
 * dokumennya bercerita berbeda tanpa ada yang tahu mana yang benar.
 */

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Diposting',
  VOID: 'Dibatalkan',
};

export const JOURNAL_STATUS_OPTIONS = (
  Object.keys(JOURNAL_STATUS_LABELS) as JournalStatus[]
).map((value) => ({ value, label: JOURNAL_STATUS_LABELS[value] }));

export const JOURNAL_SOURCE_LABELS: Record<JournalSource, string> = {
  MANUAL: 'Jurnal Manual',
  PURCHASE: 'Pembelian',
  SALES: 'Penjualan',
  INVENTORY: 'Persediaan',
  PRODUCTION: 'Produksi',
  BUYBACK: 'Buyback',
  PAYMENT: 'Pembayaran',
  ADJUSTMENT: 'Penyesuaian',
};

export const JOURNAL_SOURCE_OPTIONS = (
  Object.keys(JOURNAL_SOURCE_LABELS) as JournalSource[]
).map((value) => ({ value, label: JOURNAL_SOURCE_LABELS[value] }));

/** Warna badge status — dipakai tabel dan halaman detail supaya seragam. */
export const JOURNAL_STATUS_BADGE: Record<JournalStatus, 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'warning',
  POSTED: 'success',
  VOID: 'destructive',
};

/** Dua angka di belakang koma — sama dengan `@db.Decimal(18, 2)` di skema. */
export const JOURNAL_MONEY_SCALE = 2;

/**
 * Hanya jurnal manual yang masih draft yang boleh diubah atau dihapus.
 *
 * Dua syarat, bukan satu. Draft bersumber modul lain tetap tidak boleh disentuh
 * dari layar ini: yang menentukan isinya adalah dokumen sumbernya.
 */
export function isJournalEditable(status: JournalStatus, source: JournalSource): boolean {
  return status === 'DRAFT' && source === 'MANUAL';
}

/** Jurnal yang sudah diposting bisa dibatalkan; draft tidak — ia dihapus saja. */
export function isJournalVoidable(status: JournalStatus): boolean {
  return status === 'POSTED';
}
