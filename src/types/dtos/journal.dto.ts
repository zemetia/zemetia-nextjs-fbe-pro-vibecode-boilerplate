import type { PaginatedDTO } from './pagination.dto';
import type { AccountTypeDTO } from './account.dto';

/**
 * Jurnal umum di kabel.
 *
 * Nilainya `number`, bukan string, meski kolomnya `Decimal(18,2)`: rupiah PT TAN
 * tidak pernah mendekati batas presisi `double`, dan mengangkutnya sebagai
 * string memindahkan kewajiban parsing ke setiap pemanggil.
 *
 * Setiap baris membawa **debit dan kredit dua-duanya**, salah satunya nol, sama
 * seperti barisnya di database. Bentuk `{ side, amount }` akan lebih ringkas
 * tapi memaksa layar merakit ulang dua kolom yang justru cara orang akuntansi
 * membaca jurnal.
 */

export type JournalStatusDTO = 'DRAFT' | 'POSTED' | 'VOID';

export type JournalSourceDTO =
  | 'MANUAL'
  | 'PURCHASE'
  | 'SALES'
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'BUYBACK'
  | 'PAYMENT'
  | 'ADJUSTMENT';

export interface JournalLineAccountDTO {
  id: string;
  code: string;
  name: string;
  type: AccountTypeDTO;
}

export interface JournalLineDTO {
  id: string;
  line_no: number;
  account: JournalLineAccountDTO;
  debit: number;
  credit: number;
  memo: string | null;
}

export interface JournalEntryDTO {
  id: string;
  number: string;
  date: string;
  description: string;
  status: JournalStatusDTO;
  source: JournalSourceDTO;
  reference_type: string | null;
  reference_id: string | null;
  /** Σ debit — sama dengan Σ kredit, jadi satu angka cukup untuk daftar. */
  total_amount: number;
  line_count: number;
  lines?: JournalLineDTO[];
  /** Kunci pengelompokan "per transaksi" (BKK/BBK/TTB/PEMBELIAN_LOCAL/dst). */
  group_key: string;
  group_label: string;
  /** Nomor dokumen sumber (voucher/TTB/PO) — jatuh ke `number` bila tak ada. */
  document_number: string;
  created_at: string;
}

export interface JournalEntryDetailDTO extends JournalEntryDTO {
  lines: JournalLineDTO[];
  created_by: { id: string; name: string | null } | null;
  posted_by: { id: string; name: string | null } | null;
  posted_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  updated_at: string;
}

export type JournalEntryListDTO = PaginatedDTO<JournalEntryDTO>;
