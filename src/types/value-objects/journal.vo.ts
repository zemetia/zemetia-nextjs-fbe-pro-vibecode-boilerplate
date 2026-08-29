import type { PaginatedVO } from './pagination.vo';
import type { AccountType } from './account.vo';

/**
 * Jurnal umum siap tampil. Setiap angka sudah punya labelnya, dan setiap
 * keputusan boleh-tidaknya sebuah tombol sudah jadi boolean — layar tidak
 * pernah menghitung ulang keduanya.
 */

export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID';

export type JournalSource =
  | 'MANUAL'
  | 'PURCHASE'
  | 'SALES'
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'BUYBACK'
  | 'PAYMENT'
  | 'ADJUSTMENT';

export interface JournalLineVO {
  id: string;
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  /** `1121 — Bank BCA`, bentuk yang dipakai tabel dan pemilih akun. */
  accountLabel: string;
  accountType: AccountType;
  debit: number;
  creditValue: number;
  /** Kosong (`''`), bukan `0`, saat sisi itu tidak dipakai — kolom nol penuh tidak terbaca. */
  debitLabel: string;
  creditLabel: string;
  memo: string;
}

export interface JournalEntryVO {
  id: string;
  number: string;
  date: string;
  dateLabel: string;
  description: string;
  status: JournalStatus;
  statusLabel: string;
  source: JournalSource;
  sourceLabel: string;
  referenceType?: string;
  referenceId?: string;
  totalAmount: number;
  totalAmountLabel: string;
  lineCount: number;
  lineCountLabel: string;
  isEditable: boolean;
  isPostable: boolean;
  isVoidable: boolean;
  /** Draft manual boleh dihapus; apa pun yang sudah masuk buku tidak. */
  isDeletable: boolean;
  createdAt: string;
}

export interface JournalEntryDetailVO extends JournalEntryVO {
  lines: JournalLineVO[];
  totalDebit: number;
  totalDebitLabel: string;
  totalCredit: number;
  totalCreditLabel: string;
  createdByName: string;
  postedByName: string;
  postedAtLabel: string;
  voidedByName: string;
  voidedAtLabel: string;
  voidReason: string;
  updatedAt: string;
}

export type JournalEntryListVO = PaginatedVO<JournalEntryVO>;
