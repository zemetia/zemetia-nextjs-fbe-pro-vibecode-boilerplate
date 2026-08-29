import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { TrialBalanceView } from '../_components/TrialBalanceView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TrialBalancePage() {
  try {
    await requirePermission('ledger-reports:trial-balance');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Neraca Saldo</Typography>
        <Typography variant="muted">
          Saldo awal, mutasi periode, dan saldo akhir seluruh akun daun. Totalnya menjumlahkan
          persis baris yang tampil, supaya bisa diperiksa dengan kalkulator.
        </Typography>
      </div>
      <TrialBalanceView />
    </div>
  );
}
