import type { Prisma } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import { voucherKind, VOUCHER_KIND_LABELS } from '@/lib/cash-voucher';
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

/** Dokumen sumber — dipakai untuk mengelompokkan daftar jurnal per transaksi. */
const SOURCE_DOCUMENT_INCLUDE = {
  cashVoucher: { select: { number: true, fund: true, direction: true } },
  purchase: { select: { number: true, type: true } },
  delivery: { select: { number: true } },
} as const;

/** Baris daftar: menyertakan baris akun untuk tampilan debit & kredit per transaksi. */
export const JOURNAL_ENTRY_LIST_INCLUDE = {
  lines: LINE_INCLUDE,
  ...SOURCE_DOCUMENT_INCLUDE,
} as const;

export const JOURNAL_ENTRY_DETAIL_INCLUDE = {
  lines: LINE_INCLUDE,
  ...SOURCE_DOCUMENT_INCLUDE,
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

const SOURCE_GROUP_LABELS: Record<string, string> = {
  PRODUCTION: 'Produksi',
  BUYBACK: 'Buyback',
  ADJUSTMENT: 'Penyesuaian',
  MANUAL: 'Jurnal Manual',
};

/**
 * Kunci & label pengelompokan transaksi untuk daftar Jurnal Umum.
 *
 * Bukan `source` mentah (8 nilai terlalu kasar) — dokumen sumber sebenarnya
 * (voucher/TTB/PO) yang menentukan kelompoknya, karena itulah yang dimaksud
 * "per transaksi" oleh pengguna. `source` dipakai hanya untuk kelompok yang
 * belum punya dokumen bertaut (Produksi, Buyback, Penyesuaian, Manual).
 */
function sourceGroup(
  entry: JournalEntryListRow | JournalEntryDetailRow,
): { key: string; label: string; documentNumber: string } {
  if (entry.cashVoucher) {
    const kind = voucherKind(entry.cashVoucher.fund, entry.cashVoucher.direction);
    return {
      key: kind,
      label: `${VOUCHER_KIND_LABELS[kind]} (${kind})`,
      documentNumber: entry.cashVoucher.number,
    };
  }

  if (entry.delivery) {
    return { key: 'TTB', label: 'Terima Barang (TTB)', documentNumber: entry.delivery.number };
  }

  if (entry.purchase) {
    const label = entry.purchase.type === 'IMPORT' ? 'Pembelian Import (PO)' : 'Pembelian Lokal (PO)';
    return { key: `PEMBELIAN_${entry.purchase.type}`, label, documentNumber: entry.purchase.number };
  }

  if (entry.source === 'SALES') {
    return { key: 'PENJUALAN', label: 'Penjualan', documentNumber: entry.number };
  }
  if (entry.source === 'INVENTORY') {
    return { key: 'PERSEDIAAN', label: 'Persediaan', documentNumber: entry.number };
  }

  return {
    key: entry.source,
    label: SOURCE_GROUP_LABELS[entry.source] ?? entry.source,
    documentNumber: entry.number,
  };
}

function toBaseDTO(
  entry: JournalEntryListRow | JournalEntryDetailRow,
  lines: readonly JournalLineRow[],
): JournalEntryDTO {
  const group = sourceGroup(entry);

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
    lines: lines.map(toLineDTO),
    group_key: group.key,
    group_label: group.label,
    document_number: group.documentNumber,
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
