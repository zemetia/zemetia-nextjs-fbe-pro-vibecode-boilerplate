import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { postJournalEntry, voidJournalEntry } from '@/lib/journal';
import { loadJournalEntryDetail } from '@/lib/journal-read';
import { journalEntryStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Dua perpindahan, dua izin:
 *
 * ```
 * DRAFT ──posting──▶ POSTED ──batalkan──▶ VOID
 * ```
 *
 * Tidak ada jalan pulang dari `POSTED` ke `DRAFT`. Jurnal yang sudah dihitung
 * neraca hanya bisa dibatalkan dan digantikan — mengembalikannya jadi draft akan
 * mengubah laporan yang sudah dicetak orang tanpa meninggalkan jejak apa pun
 * bahwa isinya pernah berbeda.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = journalEntryStatusSchema.parse(await request.json());

    if (body.status === 'POSTED') {
      await requirePermission('journal-entries:post');
      await postJournalEntry(id, session.user.id);
    } else {
      await requirePermission('journal-entries:void');
      await voidJournalEntry(id, session.user.id, body.void_reason);
    }

    return NextResponse.json(await loadJournalEntryDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
