import { NextResponse } from 'next/server';


import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { deleteJournalEntry, updateJournalEntry } from '@/lib/journal';
import { loadJournalEntryDetail } from '@/lib/journal-read';
import { updateJournalEntrySchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('journal-entries:detail');
    const { id } = await params;

    return NextResponse.json(await loadJournalEntryDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('journal-entries:update');

    const { id } = await params;
    const body = updateJournalEntrySchema.parse(await request.json());

    await updateJournalEntry(
      id,
      {
        date: toUtcDateOnly(body.date),
        description: body.description,
        lines: body.lines.map((line) => ({
          accountId: line.account_id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo ?? null,
        })),
      },
    );

    return NextResponse.json(await loadJournalEntryDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('journal-entries:delete');
    const { id } = await params;

    await deleteJournalEntry(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
