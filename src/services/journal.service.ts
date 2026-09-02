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
import type { AccountTypeDTO } from '@/types/dtos/account.dto';
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

function safeString(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function accountLabel(code: string, name: string): string {
  return `${code} — ${name}`;
}

function toLineVO(line: JournalLineDTO): JournalLineVO {
  const accountCode = safeString(line.account?.code, '—');
  const accountName = safeString(line.account?.name, 'Akun');
  const memoText = safeString(line.memo, EMPTY);

  return {
    id: safeString(line.id, 'line'),
    lineNo: typeof line.line_no === 'number' ? line.line_no : 1,
    accountId: safeString(line.account?.id, accountCode),
    accountCode,
    accountName,
    accountLabel: accountLabel(accountCode, accountName),
    accountType: line.account?.type ?? 'ASSET',
    debit: typeof line.debit === 'number' && !isNaN(line.debit) ? line.debit : 0,
    creditValue: typeof line.credit === 'number' && !isNaN(line.credit) ? line.credit : 0,
    debitLabel: side(typeof line.debit === 'number' && !isNaN(line.debit) ? line.debit : 0),
    creditLabel: side(typeof line.credit === 'number' && !isNaN(line.credit) ? line.credit : 0),
    memo: memoText || EMPTY,
  };
}

function toVO(dto: JournalEntryDTO): JournalEntryVO {
  const editable = isJournalEditable(dto.status, dto.source);
  const lines = dto.lines?.map(toLineVO);
  const totalDebit = lines ? lines.reduce((sum, line) => sum + line.debit, 0) : undefined;
  const totalCredit = lines ? lines.reduce((sum, line) => sum + line.creditValue, 0) : undefined;

  const validNumber = safeString(dto.number, 'JRN-UNKNOWN');
  const validDate = safeString(dto.date, '2026-01-01');
  const validDesc = safeString(dto.description, 'Jurnal Mutasi');
  const validAmount = typeof dto.total_amount === 'number' && !isNaN(dto.total_amount) ? dto.total_amount : 0;
  const validLineCount = typeof dto.line_count === 'number' && !isNaN(dto.line_count) ? dto.line_count : (lines?.length ?? 0);

  return {
    id: safeString(dto.id, 'jrn'),
    number: validNumber,
    date: validDate,
    dateLabel: formatDateShort(validDate),
    description: validDesc,
    status: dto.status,
    statusLabel: JOURNAL_STATUS_LABELS[dto.status] ?? safeString(dto.status, 'POSTED'),
    source: dto.source,
    sourceLabel: JOURNAL_SOURCE_LABELS[dto.source] ?? safeString(dto.source, 'MANUAL'),
    referenceType: dto.reference_type ? safeString(dto.reference_type) : undefined,
    referenceId: dto.reference_id ? safeString(dto.reference_id) : undefined,
    groupKey: safeString(dto.group_key, dto.source),
    groupLabel: safeString(dto.group_label, JOURNAL_SOURCE_LABELS[dto.source] ?? dto.source),
    documentNumber: safeString(dto.document_number, validNumber),
    totalAmount: validAmount,
    totalAmountLabel: money(validAmount),
    lineCount: validLineCount,
    lineCountLabel: `${formatNumber(validLineCount)} baris`,
    lines,
    totalDebit,
    totalDebitLabel: totalDebit !== undefined ? money(totalDebit) : undefined,
    totalCredit,
    totalCreditLabel: totalCredit !== undefined ? money(totalCredit) : undefined,
    isEditable: editable,
    isPostable: dto.status === 'DRAFT',
    isVoidable: isJournalVoidable(dto.status),
    isDeletable: editable,
    createdAt: safeString(dto.created_at, new Date().toISOString()),
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

interface StorageAccountItem {
  code: string;
  name: string;
  category?: string;
  id?: string;
}

interface StorageLineItem {
  id?: string | number;
  accountCode?: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  memo?: string;
  description?: string;
}

interface StorageJournalItem {
  id?: string | number;
  entryNumber?: string;
  date?: string;
  description?: string;
  status?: string;
  source?: string;
  referenceType?: string;
  referenceId?: string;
  lines?: StorageLineItem[];
  createdAt?: string;
}

function resolveAccountType(category?: string): AccountTypeDTO {
  switch (category) {
    case 'kewajiban':
      return 'LIABILITY';
    case 'ekuitas':
      return 'EQUITY';
    case 'pendapatan':
      return 'REVENUE';
    case 'beban':
      return 'COST_EXPENSE';
    default:
      return 'ASSET';
  }
}

export const journalEntryService = {
  list: async (params?: JournalEntryListParams): Promise<JournalEntryListVO> => {
    try {
      const res = await apiClient.get<JournalEntryListDTO>(
        `/api/journal-entries${buildListQuery(params)}`,
        { cache: 'no-store' },
      );
      if (res && res.data && res.data.length > 0) {
        return toPaginatedVO(res, toVO);
      }
    } catch {
      // API call failed or offline mode, fallback to client storage
    }

    if (typeof window !== 'undefined') {
      try {
        const { getJournalEntries, getCOA } = await import('./storageService');
        const coaList = (typeof getCOA === 'function' ? getCOA() : []) as StorageAccountItem[];
        const rawJournals = (typeof getJournalEntries === 'function' ? getJournalEntries() : []) as StorageJournalItem[];

        if (rawJournals.length > 0) {
          let filtered = [...rawJournals];
          if (params?.q) {
            const query = params.q.toLowerCase();
            filtered = filtered.filter(
              (j) =>
                (j.entryNumber || '').toLowerCase().includes(query) ||
                (j.description || '').toLowerCase().includes(query) ||
                (j.lines || []).some(
                  (l) =>
                    (l.accountCode || '').toLowerCase().includes(query) ||
                    (l.accountName || '').toLowerCase().includes(query),
                ),
            );
          }
          const filterStatus = params?.status as string | undefined;
          if (filterStatus && filterStatus !== 'all') {
            filtered = filtered.filter((j) => (j.status || 'POSTED') === filterStatus);
          }
          const filterSource = params?.source as string | undefined;
          if (filterSource && filterSource !== 'all') {
            filtered = filtered.filter((j) => (j.source || 'MANUAL') === filterSource);
          }
          if (params?.account_id) {
            const targetAccId = params.account_id;
            filtered = filtered.filter((j) =>
              (j.lines || []).some((l) => l.accountCode === targetAccId),
            );
          }
          if (params?.date_from) {
            const fromDate = params.date_from;
            filtered = filtered.filter((j) => (j.date || '') >= fromDate);
          }
          if (params?.date_to) {
            const toDate = params.date_to;
            filtered = filtered.filter((j) => (j.date || '') <= toDate);
          }

          const mappedItems: JournalEntryDTO[] = filtered.map((j, index) => {
            const lines: JournalLineDTO[] = (j.lines || []).map((l, lineIdx) => {
              const rawAccCode = safeString(l.accountCode, '9999');
              const account = coaList.find((a) => a.code === rawAccCode) || {
                code: rawAccCode,
                name: safeString(l.accountName, rawAccCode),
                category: 'aset',
              };

              const lineDebit = typeof l.debit === 'number' && !isNaN(l.debit) ? l.debit : Number(l.debit || 0);
              const lineCredit = typeof l.credit === 'number' && !isNaN(l.credit) ? l.credit : Number(l.credit || 0);
              const memoStr = safeString(l.memo || l.description, '');

              return {
                id: `storage-line-${safeString(j.id, String(index))}-${lineIdx}`,
                line_no: lineIdx + 1,
                account: {
                  id: safeString(account.code, '9999'),
                  code: safeString(account.code, '9999'),
                  name: safeString(account.name, 'Akun'),
                  type: resolveAccountType(account.category),
                },
                debit: lineDebit,
                credit: lineCredit,
                memo: memoStr || null,
              };
            });

            const total = lines.reduce((sum, l) => sum + l.debit, 0);
            const entryNum = safeString(
              j.entryNumber || (j as Record<string, unknown>).number || (j as Record<string, unknown>).reference,
              `JRN-2026-${String(index + 1).padStart(4, '0')}`,
            );

            return {
              id: safeString(j.id, `storage-jrn-${index}`),
              number: entryNum,
              date: safeString(j.date, new Date().toISOString().split('T')[0] ?? '2026-01-01'),
              description: safeString(j.description, 'Jurnal Penyesuaian'),
              status: (safeString(j.status, 'POSTED')) as JournalStatusDTO,
              source: (safeString(j.source, 'MANUAL')) as JournalSourceDTO,
              reference_type: j.referenceType ? safeString(j.referenceType) : null,
              reference_id: j.referenceId ? safeString(j.referenceId) : null,
              total_amount: total,
              line_count: lines.length,
              lines,
              group_key: safeString(j.source, 'MANUAL'),
              group_label: JOURNAL_SOURCE_LABELS[(safeString(j.source, 'MANUAL')) as JournalSourceDTO] ?? safeString(j.source, 'MANUAL'),
              document_number: entryNum,
              created_at: safeString(j.createdAt, new Date().toISOString()),
            };
          });

          const page = params?.page || 1;
          const limit = params?.limit || 20;
          const start = (page - 1) * limit;
          const paginated = mappedItems.slice(start, start + limit);

          const fallbackListDto: JournalEntryListDTO = {
            data: paginated,
            total: mappedItems.length,
            page,
            page_size: limit,
            total_pages: Math.max(1, Math.ceil(mappedItems.length / limit)),
          };

          return toPaginatedVO(fallbackListDto, toVO);
        }
      } catch (err) {
        console.warn('Fallback storage journal error:', err);
      }
    }

    return toPaginatedVO(
      {
        data: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 1,
      },
      toVO,
    );
  },

  detail: async (id: string): Promise<JournalEntryDetailVO> => {
    try {
      return toDetailVO(
        await apiClient.get<JournalEntryDetailDTO>(`/api/journal-entries/${id}`, {
          cache: 'no-store',
        }),
      );
    } catch (apiErr) {
      if (typeof window !== 'undefined') {
        const { getJournalEntries, getCOA } = await import('./storageService');
        const coaList = (typeof getCOA === 'function' ? getCOA() : []) as StorageAccountItem[];
        const rawJournals = (typeof getJournalEntries === 'function' ? getJournalEntries() : []) as StorageJournalItem[];
        const found = rawJournals.find((j) => String(j.id) === id || j.entryNumber === id);

        if (found) {
          const lines: JournalLineDTO[] = (found.lines || []).map((l, lineIdx) => {
            const account = coaList.find((a) => a.code === l.accountCode) || {
              code: l.accountCode || '9999',
              name: l.accountName || l.accountCode || 'Akun',
            };
            return {
              id: `storage-line-${found.id}-${lineIdx}`,
              line_no: lineIdx + 1,
              account: {
                id: account.code,
                code: account.code,
                name: account.name,
                type: resolveAccountType(account.category),
              },
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
              memo: l.memo || l.description || null,
            };
          });

          const total = lines.reduce((s, line) => s + line.debit, 0);

          const mappedDetail: JournalEntryDetailDTO = {
            id: String(found.id),
            number: found.entryNumber || `JRN-${found.id}`,
            date: found.date || (new Date().toISOString().split('T')[0] ?? '2026-01-01'),
            description: found.description || 'Jurnal Transaksi',
            status: (found.status || 'POSTED') as JournalStatusDTO,
            source: (found.source || 'MANUAL') as JournalSourceDTO,
            reference_type: found.referenceType ?? null,
            reference_id: found.referenceId ?? null,
            total_amount: total,
            line_count: lines.length,
            lines,
            group_key: safeString(found.source, 'MANUAL'),
            group_label: JOURNAL_SOURCE_LABELS[(safeString(found.source, 'MANUAL')) as JournalSourceDTO] ?? safeString(found.source, 'MANUAL'),
            document_number: found.entryNumber || `JRN-${found.id}`,
            created_by: { id: 'usr-admin', name: 'Super Admin' },
            posted_by: { id: 'usr-admin', name: 'Super Admin' },
            posted_at: found.createdAt || new Date().toISOString(),
            voided_by: null,
            voided_at: null,
            void_reason: null,
            created_at: found.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return toDetailVO(mappedDetail);
        }
      }
      throw apiErr;
    }
  },

  create: async (payload: JournalEntryWritePayload): Promise<JournalEntryDetailVO> => {
    try {
      return toDetailVO(await apiClient.post<JournalEntryDetailDTO>('/api/journal-entries', payload));
    } catch (apiErr) {
      if (typeof window !== 'undefined') {
        const { addJournalEntry, getCOA } = await import('./storageService');
        const coaList = (typeof getCOA === 'function' ? getCOA() : []) as StorageAccountItem[];
        const storageLines = payload.lines.map((l) => {
          const acc = coaList.find((a) => a.code === l.account_id || a.id === l.account_id);
          return {
            accountCode: acc?.code || l.account_id,
            accountName: acc?.name || l.account_id,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo,
          };
        });

        const res = await addJournalEntry({
          date: payload.date,
          description: payload.description,
          lines: storageLines,
        });

        if (res && res.entry) {
          const e = res.entry as {
            id?: string | number;
            entryNumber: string;
            date: string;
            description: string;
            createdAt?: string;
          };
          const mappedDetail: JournalEntryDetailDTO = {
            id: String(e.id ?? 'entry-new'),
            number: e.entryNumber,
            date: e.date,
            description: e.description,
            status: 'POSTED',
            source: 'MANUAL',
            reference_type: null,
            reference_id: null,
            total_amount: storageLines.reduce((s, line) => s + line.debit, 0),
            line_count: storageLines.length,
            group_key: 'MANUAL',
            group_label: JOURNAL_SOURCE_LABELS.MANUAL,
            document_number: e.entryNumber,
            lines: storageLines.map((line, idx) => ({
              id: `line-${idx}`,
              line_no: idx + 1,
              account: {
                id: line.accountCode,
                code: line.accountCode,
                name: line.accountName,
                type: 'ASSET',
              },
              debit: line.debit,
              credit: line.credit,
              memo: line.memo || null,
            })),
            created_by: { id: 'usr-admin', name: 'Super Admin' },
            posted_by: { id: 'usr-admin', name: 'Super Admin' },
            posted_at: new Date().toISOString(),
            voided_by: null,
            voided_at: null,
            void_reason: null,
            created_at: e.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return toDetailVO(mappedDetail);
        }
      }
      throw apiErr;
    }
  },

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
