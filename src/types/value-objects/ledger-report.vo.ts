import type { AccountType, NormalBalance } from './account.vo';
import type { JournalSource } from './journal.vo';

/**
 * Buku besar dan neraca saldo siap tampil.
 *
 * Setiap angka datang berpasangan dengan labelnya, dan sisi yang tidak dipakai
 * datang sebagai string kosong — bukan `Rp 0`. Sebuah laporan buku besar dibaca
 * dengan menyapu satu kolom dari atas ke bawah, dan kolom penuh nol memaksa mata
 * membedakan nol yang berarti "tidak di sisi ini" dari nol yang berarti nilai.
 */

export interface LedgerAccountRefVO {
  id: string;
  code: string;
  name: string;
  /** `1121 — Bank BCA`. */
  label: string;
  type: AccountType;
  typeLabel: string;
  normalBalance: NormalBalance;
  normalBalanceLabel: string;
}

export interface LedgerSidesVO {
  debit: number;
  credit: number;
  debitLabel: string;
  creditLabel: string;
}

export interface GeneralLedgerRowVO {
  lineId: string;
  entryId: string;
  number: string;
  date: string;
  dateLabel: string;
  description: string;
  source: JournalSource;
  sourceLabel: string;
  memo: string;
  debit: number;
  credit: number;
  debitLabel: string;
  creditLabel: string;
  runningBalance: number;
  runningBalanceLabel: string;
}

export interface GeneralLedgerVO {
  account: LedgerAccountRefVO;
  openingBalance: number;
  openingBalanceLabel: string;
  pageOpeningBalance: number;
  pageOpeningBalanceLabel: string;
  rows: GeneralLedgerRowVO[];
  period: LedgerSidesVO;
  closingBalance: number;
  closingBalanceLabel: string;
  total: number;
  totalLabel: string;
  page: number;
  pageSize: number;
  totalPages: number;
  isEmpty: boolean;
}

export interface TrialBalanceRowVO {
  account: LedgerAccountRefVO;
  opening: LedgerSidesVO;
  period: LedgerSidesVO;
  closing: LedgerSidesVO;
}

export interface TrialBalanceVO {
  rows: TrialBalanceRowVO[];
  totals: {
    opening: LedgerSidesVO;
    period: LedgerSidesVO;
    closing: LedgerSidesVO;
    isBalanced: boolean;
  };
  accountCount: number;
  accountCountLabel: string;
  isEmpty: boolean;
}
