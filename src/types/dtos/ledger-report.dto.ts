import type { AccountTypeDTO, NormalBalanceDTO } from './account.dto';
import type { JournalSourceDTO } from './journal.dto';

/**
 * Buku besar dan neraca saldo — dua bacaan atas jurnal yang sudah diposting,
 * tanpa satu pun kolom saldo yang disimpan di baliknya. Setiap angka di sini
 * bisa dihitung ulang dari `journal_lines`, dan itu memang satu-satunya cara ia
 * pernah dihitung.
 *
 * **Hanya `POSTED` yang masuk hitungan.** Draft belum disepakati dan yang batal
 * sudah tidak berlaku; neraca saldo yang totalnya bergeser karena ada orang
 * sedang mengetik draft tidak bisa dipakai menutup buku.
 */

export interface LedgerAccountRefDTO {
  id: string;
  code: string;
  name: string;
  type: AccountTypeDTO;
  normal_balance: NormalBalanceDTO;
}

/** Sepasang kolom debit/kredit — bentuk yang dibaca neraca saldo. */
export interface LedgerSidesDTO {
  debit: number;
  credit: number;
}

// ─── Buku besar ──────────────────────────────────────────────────────────────

export interface GeneralLedgerRowDTO {
  line_id: string;
  entry_id: string;
  number: string;
  date: string;
  description: string;
  source: JournalSourceDTO;
  memo: string | null;
  debit: number;
  credit: number;
  /** Saldo akun setelah baris ini, bertanda menurut sisi normal akunnya. */
  running_balance: number;
}

export interface GeneralLedgerDTO {
  account: LedgerAccountRefDTO;
  /** Saldo sebelum tanggal awal periode. Nol saat periodenya tidak dibatasi. */
  opening_balance: number;
  /** Saldo tepat sebelum baris pertama halaman ini — bukan sebelum periodenya. */
  page_opening_balance: number;
  rows: GeneralLedgerRowDTO[];
  /** Mutasi seluruh periode, bukan hanya halaman yang tampil. */
  period: LedgerSidesDTO;
  closing_balance: number;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Neraca saldo ────────────────────────────────────────────────────────────

export interface TrialBalanceRowDTO {
  account: LedgerAccountRefDTO;
  opening: LedgerSidesDTO;
  period: LedgerSidesDTO;
  closing: LedgerSidesDTO;
}

export interface TrialBalanceTotalsDTO {
  opening: LedgerSidesDTO;
  period: LedgerSidesDTO;
  closing: LedgerSidesDTO;
  /**
   * Σ debit = Σ kredit di ketiga pasang kolom. Dihitung server, bukan disimpulkan
   * layar — kalau ini `false`, yang salah ada di buku, bukan di tampilannya.
   */
  is_balanced: boolean;
}

/**
 * Tidak dipaginasi, dan itu keputusan: total neraca saldo harus menjumlahkan
 * persis baris yang tampil. Total yang dihitung atas seluruh akun sementara
 * layar menampilkan 25 di antaranya adalah laporan yang tidak bisa diperiksa
 * dengan kalkulator.
 */
export interface TrialBalanceDTO {
  rows: TrialBalanceRowDTO[];
  totals: TrialBalanceTotalsDTO;
  account_count: number;
}
