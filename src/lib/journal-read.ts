import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO } from '@/lib/pagination';
import {
  JOURNAL_ENTRY_DETAIL_INCLUDE,
  JOURNAL_ENTRY_LIST_INCLUDE,
  toJournalEntryDetailDTO,
  toJournalEntryDTO,
} from '@/lib/journal-dto';
import type { JournalEntryListQuery } from '@/lib/validations';
import type { JournalEntryDetailDTO, JournalEntryListDTO } from '@/types/dtos';

/**
 * Pembaca jurnal umum. Satu tempat untuk `where`-nya, karena daftar jurnal dan
 * buku besar menyaring hal yang sama dan filter yang menyimpang diam-diam di
 * salah satunya adalah dua laporan yang tidak bisa dicocokkan.
 */

export function journalEntryWhere(query: {
  q?: string;
  status?: Prisma.JournalEntryWhereInput['status'];
  source?: Prisma.JournalEntryWhereInput['source'];
  account_id?: string;
  date_from?: string;
  date_to?: string;
}): Prisma.JournalEntryWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.account_id ? { lines: { some: { accountId: query.account_id } } } : {}),
    ...(query.date_from || query.date_to
      ? {
          date: {
            ...(query.date_from ? { gte: toUtcDateOnly(query.date_from) } : {}),
            ...(query.date_to ? { lte: toUtcDateOnly(query.date_to) } : {}),
          },
        }
      : {}),
    // Nomor jurnal dan keterangannya, karena keterangan adalah tempat nomor
    // dokumen sumber tinggal — orang mencari "INV-2026-0142", bukan "JV-...".
    ...(query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' as const } },
            { description: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export async function loadJournalEntryList(
  query: JournalEntryListQuery,
  skip: number,
  take: number,
): Promise<JournalEntryListDTO> {
  const where = journalEntryWhere(query);

  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take,
      // Tanggal dulu, nomor sesudahnya: dua jurnal bertanggal sama urut menurut
      // nomornya, jadi urutannya stabil dan halaman 2 tidak pernah mengulang
      // baris yang sudah tampil di halaman 1.
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      include: JOURNAL_ENTRY_LIST_INCLUDE,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return buildPaginatedDTO(rows, total, query, toJournalEntryDTO);
}

export async function loadJournalEntryDetail(id: string): Promise<JournalEntryDetailDTO> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: JOURNAL_ENTRY_DETAIL_INCLUDE,
  });

  if (!entry) throw new NotFoundError('Jurnal yang dipilih tidak ditemukan.');

  return toJournalEntryDetailDTO(entry);
}
