import type {
  VoucherCategoryDTO,
  VoucherDirectionDTO,
  VoucherFundDTO,
  VoucherKindDTO,
  VoucherPaymentMethodDTO,
  VoucherStatusDTO,
  VoucherTransferChannelDTO,
} from '@/types/dtos';
import type { PaginatedVO } from './pagination.vo';

export type VoucherStatus = VoucherStatusDTO;
export type VoucherFund = VoucherFundDTO;
export type VoucherDirection = VoucherDirectionDTO;
export type VoucherCategory = VoucherCategoryDTO;
export type VoucherPaymentMethod = VoucherPaymentMethodDTO;
export type VoucherTransferChannel = VoucherTransferChannelDTO;
export type VoucherKind = VoucherKindDTO;

export interface CashVoucherFundVO {
  id: string;
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountLabel: string;
  amount: number;
  amountLabel: string;
  note: string;
}

export interface CashVoucherLineVO {
  id: string;
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountLabel: string;
  description: string;
  amount: number;
  amountLabel: string;
}

/**
 * Client-ready voucher row. Every number arrives both raw (for maths) and
 * formatted (for the screen) — a table cell must never format a number inline,
 * see hard constraint #19.
 */
export interface CashVoucherVO {
  id: string;
  number: string;
  status: VoucherStatus;
  statusLabel: string;
  fund: VoucherFund;
  fundLabel: string;
  direction: VoucherDirection;
  directionLabel: string;
  /** `BKK` — derived from fund × direction, not a stored column. */
  kind: VoucherKind;
  kindLabel: string;
  /** `YYYY-MM-DD`. */
  date: string;
  dateLabel: string;
  category: VoucherCategory;
  categoryLabel: string;
  counterpartyName: string;
  /** "Dibayarkan kepada" / "Diterima dari", following the direction. */
  counterpartyFieldLabel: string;
  partnerId: string | undefined;
  partnerCode: string;
  partnerName: string;
  purpose: string;
  funds: CashVoucherFundVO[];
  /**
   * The fund side in one line, for a table cell: the account when there is one,
   * "BCA +1 rekening" when there are more. Derived here rather than in the cell so
   * every screen shortens it the same way.
   */
  fundSummaryLabel: string;
  paymentMethod: VoucherPaymentMethod;
  paymentMethodLabel: string;
  transferChannel: VoucherTransferChannel | undefined;
  transferChannelLabel: string;
  bankName: string;
  bankAccountNo: string;
  referenceNumber: string;
  dueDate: string | undefined;
  dueDateLabel: string;
  autoPostOnApproval: boolean;
  totalAmount: number;
  totalAmountLabel: string;
  notes: string;
  /** The states that decide which row actions are offered. */
  isEditable: boolean;
  isSubmittable: boolean;
  isReviewable: boolean;
  isPostable: boolean;
  isVoidable: boolean;
  createdAt: string;
}

export interface CashVoucherDetailVO extends CashVoucherVO {
  lines: CashVoucherLineVO[];
  createdByName: string;
  reviewedByName: string;
  reviewedAt: string | undefined;
  /** `—` until it happened, so a detail row never renders a blank. */
  reviewedAtLabel: string;
  reviewNote: string;
  postedByName: string;
  postedAt: string | undefined;
  postedAtLabel: string;
  voidedByName: string;
  voidedAt: string | undefined;
  voidedAtLabel: string;
  voidReason: string;
  journalId: string | undefined;
  journalNumber: string;
  updatedAt: string;
}

export type CashVoucherListVO = PaginatedVO<CashVoucherVO>;
