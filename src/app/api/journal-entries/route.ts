import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { parseListQuery, toPageWindow } from '@/lib/pagination';
import { createJournalEntry } from '@/lib/journal';
import { loadJournalEntryDetail, loadJournalEntryList } from '@/lib/journal-read';
import { createJournalEntrySchema, journalEntryListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('journal-entries:list');

    const query = parseListQuery(request, journalEntryListQuerySchema);
    const { skip, take } = toPageWindow(query);

    return NextResponse.json(await loadJournalEntryList(query, skip, take));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Jurnal baru selalu lahir sebagai draft, tidak pernah langsung masuk buku.
 *
 * Menyimpan dan memposting adalah dua keputusan yang berbeda — yang pertama
 * "ini yang saya maksud", yang kedua "ini boleh dihitung". Menyatukannya
 * menghapus satu-satunya kesempatan membaca ulang sebelum angkanya ikut ke
 * neraca.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('journal-entries:create');
    const session = await requireAuth();

    const body = createJournalEntrySchema.parse(await request.json());

    const entry = await createJournalEntry(
      {
        date: toUtcDateOnly(body.date),
        description: body.description,
        source: 'MANUAL',
        lines: body.lines.map((line) => ({
          accountId: line.account_id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo ?? null,
        })),
      },
      session.user.id,
    );

    return NextResponse.json(await loadJournalEntryDetail(entry.id), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
