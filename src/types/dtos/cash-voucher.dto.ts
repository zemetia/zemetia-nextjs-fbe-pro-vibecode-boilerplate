import type { PaginatedDTO } from './pagination.dto';

export type VoucherStatusDTO = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'VOID';
export type VoucherFundDTO = 'CASH' | 'BANK' | 'MEMORIAL';
export type VoucherDirectionDTO = 'IN' | 'OUT';
export type VoucherCategoryDTO = 'GENERAL_EXPENSE' | 'EMPLOYEE' | 'SUPPLIER';
export type VoucherTransferChannelDTO = 'BI_FAST' | 'SKN' | 'RTGS';

export type VoucherPaymentMethodDTO =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'GIRO'
  | 'CARD'
  | 'VIRTUAL_ACCOUNT'
  | 'LETTER_OF_CREDIT'
  | 'ESCROW'
  | 'GOLD'
  | 'NETTING';

/** The four field abbreviations plus memorial — derived, never stored. */
export type VoucherKindDTO = 'BKM' | 'BKK' | 'BBM' | 'BBK' | 'BM';

/** One account the money left from (or arrived in) — the voucher's fund side. */
export interface CashVoucherFundDTO {
  id: string;
  line_no: number;
  account: { id: string; code: string; name: string };
  amount: number;
  note: string | null;
}

export interface CashVoucherLineDTO {
  id: string;
  line_no: number;
  account: { id: string; code: string; name: string };
  description: string | null;
  amount: number;
}

/**
 * Row shape for the list table.
 *
 * There is no `kind` column: BKK/BKM/BBK/BBM is `fund × direction`, and the
 * client derives it with `voucherKind()`. Sending it as well would ship a second
 * answer that a later edit could leave behind.
 */
export interface CashVoucherDTO {
  id: string;
  number: string;
  status: VoucherStatusDTO;
  fund: VoucherFundDTO;
  direction: VoucherDirectionDTO;
  /** `YYYY-MM-DD`. */
  date: string;
  category: VoucherCategoryDTO;
  counterparty_name: string;
  partner: { id: string; code: string; name: string } | null;
  purpose: string;
  /** Always at least one row, even when a single account paid the whole thing. */
  funds: CashVoucherFundDTO[];
  payment_method: VoucherPaymentMethodDTO;
  transfer_channel: VoucherTransferChannelDTO | null;
  bank_name: string | null;
  bank_account_no: string | null;
  reference_number: string | null;
  /** `YYYY-MM-DD` — cheques and bilyet giro only. */
  due_date: string | null;
  auto_post_on_approval: boolean;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

export interface CashVoucherDetailDTO extends CashVoucherDTO {
  lines: CashVoucherLineDTO[];
  created_by: { id: string; name: string | null } | null;
  reviewed_by: { id: string; name: string | null } | null;
  reviewed_at: string | null;
  review_note: string | null;
  posted_by: { id: string; name: string | null } | null;
  posted_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  /** The ledger entry this voucher produced, once it has been posted. */
  journal: { id: string; number: string; status: string } | null;
  updated_at: string;
}

export type CashVoucherListDTO = PaginatedDTO<CashVoucherDTO>;

/** Preview of the number a new voucher would take. Reserves nothing. */
export interface CashVoucherNextNumberDTO {
  number: string;
}
