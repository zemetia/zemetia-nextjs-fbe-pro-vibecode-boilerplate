import { apiClient } from './client';
import { buildListQuery, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import { ACCOUNT_TYPE_LABELS, NORMAL_BALANCE_LABELS } from '@/lib/account';
import { JOURNAL_SOURCE_LABELS } from '@/lib/journal-entry';
import { LEDGER_MONEY_SCALE } from '@/lib/ledger-report';
import type {
  GeneralLedgerDTO,
  GeneralLedgerRowDTO,
  LedgerAccountRefDTO,
  LedgerSidesDTO,
  TrialBalanceDTO,
  TrialBalanceRowDTO,
} from '@/types/dtos';
import type {
  GeneralLedgerRowVO,
  GeneralLedgerVO,
  LedgerAccountRefVO,
  LedgerSidesVO,
  TrialBalanceRowVO,
  TrialBalanceVO,
} from '@/types/value-objects';

const EMPTY = '—';
const MONEY = { decimalScale: LEDGER_MONEY_SCALE } as const;

function money(value: number): string {
  return formatCurrency(value, MONEY);
}

/** Sisi yang tidak dipakai tampil kosong, bukan `Rp 0`. */
function side(value: number): string {
  return value === 0 ? '' : money(value);
}

function toSidesVO(dto: LedgerSidesDTO): LedgerSidesVO {
  return {
    debit: dto.debit,
    credit: dto.credit,
    debitLabel: side(dto.debit),
    creditLabel: side(dto.credit),
  };
}

function toAccountVO(dto: LedgerAccountRefDTO): LedgerAccountRefVO {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    label: `${dto.code} — ${dto.name}`,
    type: dto.type,
    typeLabel: ACCOUNT_TYPE_LABELS[dto.type],
    normalBalance: dto.normal_balance,
    normalBalanceLabel: NORMAL_BALANCE_LABELS[dto.normal_balance],
  };
}

function toRowVO(dto: GeneralLedgerRowDTO): GeneralLedgerRowVO {
  return {
    lineId: dto.line_id,
    entryId: dto.entry_id,
    number: dto.number,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    description: dto.description,
    source: dto.source,
    sourceLabel: JOURNAL_SOURCE_LABELS[dto.source],
    memo: dto.memo ?? EMPTY,
    debit: dto.debit,
    credit: dto.credit,
    debitLabel: side(dto.debit),
    creditLabel: side(dto.credit),
    runningBalance: dto.running_balance,
    runningBalanceLabel: money(dto.running_balance),
  };
}

function toGeneralLedgerVO(dto: GeneralLedgerDTO): GeneralLedgerVO {
  return {
    account: toAccountVO(dto.account),
    openingBalance: dto.opening_balance,
    openingBalanceLabel: money(dto.opening_balance),
    pageOpeningBalance: dto.page_opening_balance,
    pageOpeningBalanceLabel: money(dto.page_opening_balance),
    rows: dto.rows.map(toRowVO),
    period: toSidesVO(dto.period),
    closingBalance: dto.closing_balance,
    closingBalanceLabel: money(dto.closing_balance),
    total: dto.total,
    totalLabel: `${formatNumber(dto.total)} baris`,
    page: dto.page,
    pageSize: dto.page_size,
    totalPages: dto.total_pages,
    isEmpty: dto.total === 0,
  };
}

function toTrialRowVO(dto: TrialBalanceRowDTO): TrialBalanceRowVO {
  return {
    account: toAccountVO(dto.account),
    opening: toSidesVO(dto.opening),
    period: toSidesVO(dto.period),
    closing: toSidesVO(dto.closing),
  };
}

function toTrialBalanceVO(dto: TrialBalanceDTO): TrialBalanceVO {
  return {
    rows: dto.rows.map(toTrialRowVO),
    totals: {
      opening: toSidesVO(dto.totals.opening),
      period: toSidesVO(dto.totals.period),
      closing: toSidesVO(dto.totals.closing),
      isBalanced: dto.totals.is_balanced,
    },
    accountCount: dto.account_count,
    accountCountLabel: `${formatNumber(dto.account_count)} akun`,
    isEmpty: dto.account_count === 0,
  };
}

export type GeneralLedgerParams = ListParams & {
  account_id: string;
  date_from?: string;
  date_to?: string;
};

/**
 * `type`, bukan `interface` — hanya alias yang punya index signature implisit
 * yang dibutuhkan `buildListQuery` (docs/knowledge/THIS.md, 2026-08-10).
 */
export type TrialBalanceParams = {
  date_from?: string;
  date_to?: string;
  /** String, bukan boolean: ia melintas sebagai query param. */
  include_empty?: 'true' | 'false';
};

export const ledgerReportService = {
  generalLedger: async (params: GeneralLedgerParams): Promise<GeneralLedgerVO> =>
    toGeneralLedgerVO(
      await apiClient.get<GeneralLedgerDTO>(`/api/reports/ledger${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
    ),

  trialBalance: async (params?: TrialBalanceParams): Promise<TrialBalanceVO> =>
    toTrialBalanceVO(
      await apiClient.get<TrialBalanceDTO>(`/api/reports/trial-balance${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
    ),
};
