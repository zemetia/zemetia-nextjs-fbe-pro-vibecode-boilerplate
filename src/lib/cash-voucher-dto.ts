import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import type { CashVoucherDetailDTO, CashVoucherDTO } from '@/types/dtos';

/**
 * The relations every voucher response carries. Both route handlers read from
 * this one include, so a list row and a detail row can never drift apart.
 */
export const CASH_VOUCHER_INCLUDE = {
  partner: { select: { id: true, code: true, name: true } },
  // The paying accounts travel with the list row too, not only the detail:
  // "which account did this leave from" is the second thing anyone asks of a
  // voucher, and a table that has to fetch it per row asks the database once
  // per line on screen.
  funds: {
    orderBy: { lineNo: 'asc' },
    include: { account: { select: { id: true, code: true, name: true } } },
  },
} as const;

export const CASH_VOUCHER_DETAIL_INCLUDE = {
  ...CASH_VOUCHER_INCLUDE,
  lines: {
    orderBy: { lineNo: 'asc' },
    include: { account: { select: { id: true, code: true, name: true } } },
  },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  postedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} as const;

export type CashVoucherRow = Prisma.CashVoucherGetPayload<{
  include: typeof CASH_VOUCHER_INCLUDE;
}>;

export type CashVoucherDetailRow = Prisma.CashVoucherGetPayload<{
  include: typeof CASH_VOUCHER_DETAIL_INCLUDE;
}>;

/** The journal entry a posted voucher produced, looked up by reference. */
export interface VoucherJournalRef {
  id: string;
  number: string;
  status: string;
}

/** Prisma `Decimal` → plain number. The stored scale is already the right one. */
function decimal(value: Prisma.Decimal): number {
  return Number(value);
}

export function toCashVoucherDTO(row: CashVoucherRow): CashVoucherDTO {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    fund: row.fund,
    direction: row.direction,
    date: fromUtcDateOnly(row.date),
    category: row.category,
    counterparty_name: row.counterpartyName,
    partner: row.partner
      ? { id: row.partner.id, code: row.partner.code, name: row.partner.name }
      : null,
    purpose: row.purpose,
    funds: row.funds.map((fund) => ({
      id: fund.id,
      line_no: fund.lineNo,
      account: { id: fund.account.id, code: fund.account.code, name: fund.account.name },
      amount: decimal(fund.amount),
      note: fund.note,
    })),
    payment_method: row.paymentMethod,
    transfer_channel: row.transferChannel,
    bank_name: row.bankName,
    bank_account_no: row.bankAccountNo,
    reference_number: row.referenceNumber,
    due_date: row.dueDate ? fromUtcDateOnly(row.dueDate) : null,
    auto_post_on_approval: row.autoPostOnApproval,
    total_amount: decimal(row.totalAmount),
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toCashVoucherDetailDTO(
  row: CashVoucherDetailRow,
  journal: VoucherJournalRef | null = null,
): CashVoucherDetailDTO {
  return {
    ...toCashVoucherDTO(row),
    lines: row.lines.map((line) => ({
      id: line.id,
      line_no: line.lineNo,
      account: { id: line.account.id, code: line.account.code, name: line.account.name },
      description: line.description,
      amount: decimal(line.amount),
    })),
    created_by: row.createdBy,
    reviewed_by: row.reviewedBy,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    review_note: row.reviewNote,
    posted_by: row.postedBy,
    posted_at: row.postedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    journal,
    updated_at: row.updatedAt.toISOString(),
  };
}
