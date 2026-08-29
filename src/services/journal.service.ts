import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isJournalEditable,
  isJournalVoidable,
  JOURNAL_MONEY_SCALE,
  JOURNAL_SOURCE_LABELS,
  JOURNAL_STATUS_LABELS,
} from '@/lib/journal-entry';
import type {
  JournalEntryDetailDTO,
  JournalEntryDTO,
  JournalEntryListDTO,
  JournalLineDTO,
  JournalSourceDTO,
  JournalStatusDTO,
} from '@/types/dtos';
import type {
  JournalEntryDetailVO,
  JournalEntryListVO,
  JournalEntryVO,
  JournalLineVO,
} from '@/types/value-objects';

const EMPTY = '—';
const MONEY = { decimalScale: JOURNAL_MONEY_SCALE } as const;

function money(value: number): string {
  return formatCurrency(value, MONEY);
}

/**
 * Sisi yang tidak dipakai tampil kosong, bukan `Rp 0`.
 *
 * Sebuah jurnal dibaca dengan menyapu satu kolom dari atas ke bawah; kolom yang
 * penuh nol memaksa mata membedakan nol yang berarti "tidak di sisi ini" dari
 * nol yang berarti "nilainya nol", dan yang kedua tidak pernah ada.
 */
function side(value: number): string {
  return value > 0 ? money(value) : '';
}

function accountLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

function toLineVO(line: JournalLineDTO): JournalLineVO {
  return {
    id: line.id,
    lineNo: line.line_no,
    accountId: line.account.id,
    accountCode: line.account.code,
    accountName: line.account.name,
    accountLabel: accountLabel(line.account.code, line.account.name),
    accountType: line.account.type,
    debit: line.debit,
    creditValue: line.credit,
    debitLabel: side(line.debit),
    creditLabel: side(line.credit),
    memo: line.memo ?? EMPTY,
  };
}

function toVO(dto: JournalEntryDTO): JournalEntryVO {
  const editable = isJournalEditable(dto.status, dto.source);

  return {
    id: dto.id,
    number: dto.number,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    description: dto.description,
    status: dto.status,
    statusLabel: JOURNAL_STATUS_LABELS[dto.status],
    source: dto.source,
    sourceLabel: JOURNAL_SOURCE_LABELS[dto.source],
    referenceType: dto.reference_type ?? undefined,
    referenceId: dto.reference_id ?? undefined,
    totalAmount: dto.total_amount,
    totalAmountLabel: money(dto.total_amount),
    lineCount: dto.line_count,
    lineCountLabel: `${formatNumber(dto.line_count)} baris`,
    isEditable: editable,
    isPostable: dto.status === 'DRAFT',
    isVoidable: isJournalVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

/** Cap waktu audit, atau `—` selama langkah yang dicatatnya belum terjadi. */
function stamp(iso: string | null): string {
  return iso ? formatDateShort(iso) : EMPTY;
}

function toDetailVO(dto: JournalEntryDetailDTO): JournalEntryDetailVO {
  const lines = dto.lines.map(toLineVO);
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.creditValue, 0);

  return {
    ...toVO(dto),
    lines,
    totalDebit,
    totalDebitLabel: money(totalDebit),
    totalCredit,
    totalCreditLabel: money(totalCredit),
    createdByName: dto.created_by?.name ?? EMPTY,
    postedByName: dto.posted_by?.name ?? EMPTY,
    postedAtLabel: stamp(dto.posted_at),
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAtLabel: stamp(dto.voided_at),
    voidReason: dto.void_reason ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type JournalEntryListParams = ListParams & {
  status?: JournalStatusDTO;
  source?: JournalSourceDTO;
  account_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface JournalLinePayload {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntryWritePayload {
  /** `YYYY-MM-DD` — rakit dengan `toDateOnly()` dari `@/lib/date`. */
  date: string;
  description: string;
  lines: JournalLinePayload[];
}

export const journalEntryService = {
  list: async (params?: JournalEntryListParams): Promise<JournalEntryListVO> =>
    toPaginatedVO(
      await apiClient.get<JournalEntryListDTO>(`/api/journal-entries${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<JournalEntryDetailVO> =>
    toDetailVO(
      await apiClient.get<JournalEntryDetailDTO>(`/api/journal-entries/${id}`, {
        cache: 'no-store',
      }),
    ),

  create: async (payload: JournalEntryWritePayload): Promise<JournalEntryDetailVO> =>
    toDetailVO(await apiClient.post<JournalEntryDetailDTO>('/api/journal-entries', payload)),

  update: async (id: string, payload: JournalEntryWritePayload): Promise<JournalEntryDetailVO> =>
    toDetailVO(await apiClient.patch<JournalEntryDetailDTO>(`/api/journal-entries/${id}`, payload)),

  post: async (id: string): Promise<JournalEntryDetailVO> =>
    toDetailVO(
      await apiClient.patch<JournalEntryDetailDTO>(`/api/journal-entries/${id}/status`, {
        status: 'POSTED',
      }),
    ),

  void: async (id: string, reason: string): Promise<JournalEntryDetailVO> =>
    toDetailVO(
      await apiClient.patch<JournalEntryDetailDTO>(`/api/journal-entries/${id}/status`, {
        status: 'VOID',
        void_reason: reason,
      }),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/journal-entries/${id}`);
  },
};
