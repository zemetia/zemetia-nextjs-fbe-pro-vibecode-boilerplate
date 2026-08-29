import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import type { JournalEntryDetailDTO, JournalEntryDTO, JournalLineDTO } from '@/types/dtos';

/**
 * Baris Prisma → DTO jurnal.
 *
 * `Decimal` diubah jadi `number` **di sini dan hanya di sini**. Membiarkannya
 * lolos sampai ke route berarti `JSON.stringify` mengeluarkan objek Decimal
 * mentah, dan layar menerima bentuk yang tidak pernah dijanjikan DTO-nya.
 */

const LINE_INCLUDE = {
  orderBy: { lineNo: 'asc' },
  include: { account: { select: { id: true, code: true, name: true, type: true } } },
} as const;

const USER_SELECT = { select: { id: true, name: true } } as const;

/** Baris daftar: tanpa isi baris, tapi dengan agregat yang butuh barisnya. */
export const JOURNAL_ENTRY_LIST_INCLUDE = {
  lines: { select: { debit: true } },
} as const;

export const JOURNAL_ENTRY_DETAIL_INCLUDE = {
  lines: LINE_INCLUDE,
  createdBy: USER_SELECT,
  postedBy: USER_SELECT,
  voidedBy: USER_SELECT,
} as const;

type JournalEntryListRow = Prisma.JournalEntryGetPayload<{
  include: typeof JOURNAL_ENTRY_LIST_INCLUDE;
}>;

type JournalEntryDetailRow = Prisma.JournalEntryGetPayload<{
  include: typeof JOURNAL_ENTRY_DETAIL_INCLUDE;
}>;

type JournalLineRow = Prisma.JournalLineGetPayload<{ include: typeof LINE_INCLUDE.include }>;

function toNumber(value: Prisma.Decimal): number {
  return Number(value);
}

/**
 * Σ debit. Dipakai sebagai "nilai jurnal" karena Σ kredit selalu sama —
 * `createJournalEntry` menolak yang tidak, jadi menampilkan keduanya di daftar
 * hanya memakan kolom tanpa menambah informasi.
 */
function totalDebit(lines: readonly { debit: Prisma.Decimal }[]): number {
  return lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
}

function toLineDTO(line: JournalLineRow): JournalLineDTO {
  return {
    id: line.id,
    line_no: line.lineNo,
    account: {
      id: line.account.id,
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
    },
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
    memo: line.memo,
  };
}

function toBaseDTO(
  entry: JournalEntryListRow | JournalEntryDetailRow,
  lines: readonly { debit: Prisma.Decimal }[],
): JournalEntryDTO {
  return {
    id: entry.id,
    number: entry.number,
    date: fromUtcDateOnly(entry.date),
    description: entry.description,
    status: entry.status,
    source: entry.source,
    reference_type: entry.referenceType,
    reference_id: entry.referenceId,
    total_amount: totalDebit(lines),
    line_count: lines.length,
    created_at: entry.createdAt.toISOString(),
  };
}

export function toJournalEntryDTO(entry: JournalEntryListRow): JournalEntryDTO {
  return toBaseDTO(entry, entry.lines);
}

export function toJournalEntryDetailDTO(entry: JournalEntryDetailRow): JournalEntryDetailDTO {
  return {
    ...toBaseDTO(entry, entry.lines),
    lines: entry.lines.map(toLineDTO),
    created_by: entry.createdBy,
    posted_by: entry.postedBy,
    posted_at: entry.postedAt?.toISOString() ?? null,
    voided_by: entry.voidedBy,
    voided_at: entry.voidedAt?.toISOString() ?? null,
    void_reason: entry.voidReason,
    updated_at: entry.updatedAt.toISOString(),
  };
}
