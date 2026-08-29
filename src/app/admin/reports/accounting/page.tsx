import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { AccountingReportsView } from './_components/AccountingReportsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountingReportsPage() {
  try {
    await requirePermission('ledger-reports:general-ledger');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Laporan Keuangan SAK EMKM</Typography>
        <Typography variant="muted">
          Laporan Laba Rugi, Posisi Keuangan (Neraca), Arus Kas Langsung, serta Catatan Atas
          Laporan Keuangan (CALK) resmi PT. TRILIUN ANUGRAH NUSANTARA.
        </Typography>
      </div>
      <AccountingReportsView />
    </div>
  );
}
