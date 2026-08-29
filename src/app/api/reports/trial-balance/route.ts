import { NextResponse } from 'next/server';

import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { parseListQuery } from '@/lib/pagination';
import { loadTrialBalance } from '@/lib/ledger-report-read';
import { trialBalanceQuerySchema } from '@/lib/validations';

/**
 * Neraca saldo — seluruh akun daun sekaligus, tanpa paginasi.
 *
 * Tidak dipaginasi karena totalnya harus menjumlahkan persis baris yang tampil:
 * neraca saldo yang kakinya menghitung 200 akun sementara layarnya menunjukkan
 * 25 adalah laporan yang tidak bisa diperiksa dengan kalkulator, dan memeriksa
 * dengan kalkulator adalah satu-satunya alasan laporan ini ada.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('ledger-reports:trial-balance');

    const query = parseListQuery(request, trialBalanceQuerySchema);

    return NextResponse.json(await loadTrialBalance(query));
  } catch (error) {
    return handleApiError(error);
  }
}
