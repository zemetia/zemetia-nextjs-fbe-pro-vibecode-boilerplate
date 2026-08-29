import { NextResponse } from 'next/server';

import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { parseListQuery, toPageWindow } from '@/lib/pagination';
import { loadGeneralLedger } from '@/lib/ledger-report-read';
import { generalLedgerQuerySchema } from '@/lib/validations';

/**
 * Buku besar satu akun: saldo awal, setiap mutasi dalam periode, dan saldo
 * berjalan setelah masing-masing.
 *
 * Selalu satu akun, tidak pernah semuanya sekaligus — buku besar gabungan yang
 * saldonya berjalan lintas akun adalah kolom yang tidak punya arti.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('ledger-reports:general-ledger');

    const query = parseListQuery(request, generalLedgerQuerySchema);
    const { skip, take } = toPageWindow(query);

    return NextResponse.json(await loadGeneralLedger(query, skip, take));
  } catch (error) {
    return handleApiError(error);
  }
}
