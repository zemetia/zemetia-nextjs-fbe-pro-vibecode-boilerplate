import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  counterpartyLabel,
  isVoucherEditable,
  isVoucherVoidable,
  MONEY_SCALE,
  VOUCHER_CATEGORY_LABELS,
  VOUCHER_DIRECTION_LABELS,
  VOUCHER_FUND_LABELS,
  VOUCHER_KIND_LABELS,
  VOUCHER_PAYMENT_METHOD_LABELS,
  VOUCHER_STATUS_LABELS,
  VOUCHER_TRANSFER_CHANNEL_LABELS,
  voucherKind,
} from '@/lib/cash-voucher';
import type {
  CashVoucherDetailDTO,
  CashVoucherDTO,
  CashVoucherFundDTO,
  CashVoucherListDTO,
  CashVoucherNextNumberDTO,
  VoucherCategoryDTO,
  VoucherDirectionDTO,
  VoucherFundDTO,
  VoucherPaymentMethodDTO,
  VoucherStatusDTO,
  VoucherTransferChannelDTO,
} from '@/types/dtos';
import type { CashVoucherDetailVO, CashVoucherListVO, CashVoucherVO } from '@/types/value-objects';

const EMPTY = '—';

const MONEY = { decimalScale: MONEY_SCALE } as const;

function accountLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

/**
 * The fund side as one line of text. A voucher paid from one account reads as
 * that account; paid from several it names the first and counts the rest, because
 * a cell that lists three account names is a cell nobody reads.
 */
function fundSummary(funds: readonly CashVoucherFundDTO[]): string {
  const [first, ...rest] = funds;
  if (!first) return EMPTY;

  return rest.length === 0
    ? first.account.name
    : `${first.account.name} +${rest.length} rekening`;
}

/** An audit timestamp, or `—` while the step it records has not happened. */
function stamp(iso: string | null): string {
  return iso ? formatDateShort(iso) : EMPTY;
}

function toVO(dto: CashVoucherDTO): CashVoucherVO {
  // BKK/BKM/BBK/BBM is `fund × direction` and nothing else. Deriving it here
  // rather than reading a field is what keeps the two axes the single answer.
  const kind = voucherKind(dto.fund, dto.direction);

  return {
    id: dto.id,
    number: dto.number,
    status: dto.status,
    statusLabel: VOUCHER_STATUS_LABELS[dto.status],
    fund: dto.fund,
    fundLabel: VOUCHER_FUND_LABELS[dto.fund],
    direction: dto.direction,
    directionLabel: VOUCHER_DIRECTION_LABELS[dto.direction],
    kind,
    kindLabel: VOUCHER_KIND_LABELS[kind],
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    category: dto.category,
    categoryLabel: VOUCHER_CATEGORY_LABELS[dto.category],
    counterpartyName: dto.counterparty_name,
    counterpartyFieldLabel: counterpartyLabel(dto.direction),
    partnerId: dto.partner?.id,
    partnerCode: dto.partner?.code ?? EMPTY,
    partnerName: dto.partner?.name ?? EMPTY,
    purpose: dto.purpose,
    funds: dto.funds.map((fund) => ({
      id: fund.id,
      lineNo: fund.line_no,
      accountId: fund.account.id,
      accountCode: fund.account.code,
      accountName: fund.account.name,
      accountLabel: accountLabel(fund.account.code, fund.account.name),
      amount: fund.amount,
      amountLabel: formatCurrency(fund.amount, MONEY),
      note: fund.note ?? EMPTY,
    })),
    fundSummaryLabel: fundSummary(dto.funds),
    paymentMethod: dto.payment_method,
    paymentMethodLabel: VOUCHER_PAYMENT_METHOD_LABELS[dto.payment_method],
    transferChannel: dto.transfer_channel ?? undefined,
    transferChannelLabel: dto.transfer_channel
      ? VOUCHER_TRANSFER_CHANNEL_LABELS[dto.transfer_channel]
      : EMPTY,
    bankName: dto.bank_name ?? EMPTY,
    bankAccountNo: dto.bank_account_no ?? EMPTY,
    referenceNumber: dto.reference_number ?? EMPTY,
    dueDate: dto.due_date ?? undefined,
    dueDateLabel: dto.due_date ? formatDateShort(dto.due_date) : EMPTY,
    autoPostOnApproval: dto.auto_post_on_approval,
    totalAmount: dto.total_amount,
    totalAmountLabel: formatCurrency(dto.total_amount, MONEY),
    notes: dto.notes ?? EMPTY,
    isEditable: isVoucherEditable(dto.status),
    isSubmittable: dto.status === 'DRAFT',
    isReviewable: dto.status === 'PENDING_APPROVAL',
    isPostable: dto.status === 'APPROVED',
    isVoidable: isVoucherVoidable(dto.status),
    createdAt: dto.created_at,
  };
}

function toDetailVO(dto: CashVoucherDetailDTO): CashVoucherDetailVO {
  return {
    ...toVO(dto),
    lines: dto.lines.map((line) => ({
      id: line.id,
      lineNo: line.line_no,
      accountId: line.account.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountLabel: accountLabel(line.account.code, line.account.name),
      description: line.description ?? EMPTY,
      amount: line.amount,
      amountLabel: formatCurrency(line.amount, MONEY),
    })),
    createdByName: dto.created_by?.name ?? EMPTY,
    reviewedByName: dto.reviewed_by?.name ?? EMPTY,
    reviewedAt: dto.reviewed_at ?? undefined,
    reviewedAtLabel: stamp(dto.reviewed_at),
    reviewNote: dto.review_note ?? EMPTY,
    postedByName: dto.posted_by?.name ?? EMPTY,
    postedAt: dto.posted_at ?? undefined,
    postedAtLabel: stamp(dto.posted_at),
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAt: dto.voided_at ?? undefined,
    voidedAtLabel: stamp(dto.voided_at),
    voidReason: dto.void_reason ?? EMPTY,
    journalId: dto.journal?.id,
    journalNumber: dto.journal?.number ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type CashVoucherListParams = ListParams & {
  status?: VoucherStatusDTO;
  fund?: VoucherFundDTO;
  direction?: VoucherDirectionDTO;
  category?: VoucherCategoryDTO;
  payment_method?: VoucherPaymentMethodDTO;
  partner_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface CashVoucherFundPayload {
  account_id: string;
  amount: number;
  note?: string;
}

export interface CashVoucherLinePayload {
  account_id: string;
  description?: string;
  amount: number;
}

export interface CashVoucherWritePayload {
  fund: VoucherFundDTO;
  direction: VoucherDirectionDTO;
  /** `YYYY-MM-DD` — build it with `toDateOnly()` from `@/lib/date`. */
  date: string;
  category: VoucherCategoryDTO;
  counterparty_name: string;
  partner_id?: string;
  purpose: string;
  /** At least one — the accounts the money leaves from, and how much from each. */
  funds: CashVoucherFundPayload[];
  payment_method: VoucherPaymentMethodDTO;
  transfer_channel?: VoucherTransferChannelDTO | null;
  bank_name?: string;
  bank_account_no?: string;
  reference_number?: string;
  due_date?: string | null;
  auto_post_on_approval: boolean;
  /** The total is Σ of these — it is never sent, only derived server-side. */
  lines: CashVoucherLinePayload[];
  notes?: string;
}

/**
 * A `type` alias, not an interface — only aliases get the implicit index
 * signature `buildListQuery` needs (docs/knowledge/THIS.md, 2026-08-10).
 */
export type CashVoucherNextNumberParams = {
  fund: VoucherFundDTO;
  direction: VoucherDirectionDTO;
  date?: string;
};

export const cashVoucherService = {
  list: async (params?: CashVoucherListParams): Promise<CashVoucherListVO> =>
    toPaginatedVO(
      await apiClient.get<CashVoucherListDTO>(`/api/cash-vouchers${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.get<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}`, { cache: 'no-store' }),
    ),

  /** The number a new voucher would take. Reserves nothing. */
  nextNumber: async (params: CashVoucherNextNumberParams): Promise<string> =>
    (
      await apiClient.get<CashVoucherNextNumberDTO>(
        `/api/cash-vouchers/next-number${buildListQuery(params)}`,
        { cache: 'no-store' },
      )
    ).number,

  create: async (payload: CashVoucherWritePayload): Promise<CashVoucherDetailVO> =>
    toDetailVO(await apiClient.post<CashVoucherDetailDTO>('/api/cash-vouchers', payload)),

  update: async (id: string, payload: CashVoucherWritePayload): Promise<CashVoucherDetailVO> =>
    toDetailVO(await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}`, payload)),

  submit: async (id: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}/status`, {
        status: 'PENDING_APPROVAL',
      }),
    ),

  approve: async (id: string, note?: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}/status`, {
        status: 'APPROVED',
        review_note: note,
      }),
    ),

  /** Sends it back to the clerk. The note is the only record the rejection leaves. */
  returnToDraft: async (id: string, note: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}/status`, {
        status: 'DRAFT',
        review_note: note,
      }),
    ),

  post: async (id: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}/status`, {
        status: 'POSTED',
      }),
    ),

  void: async (id: string, reason: string): Promise<CashVoucherDetailVO> =>
    toDetailVO(
      await apiClient.patch<CashVoucherDetailDTO>(`/api/cash-vouchers/${id}/status`, {
        status: 'VOID',
        void_reason: reason,
      }),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/cash-vouchers/${id}`);
  },
};
