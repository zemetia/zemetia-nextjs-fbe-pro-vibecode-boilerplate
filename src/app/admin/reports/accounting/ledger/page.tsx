import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { GeneralLedgerView } from '../_components/GeneralLedgerView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GeneralLedgerPage() {
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
        <Typography variant="h2">Buku Besar</Typography>
        <Typography variant="muted">
          Mutasi satu akun beserta saldo berjalannya, urut maju menurut tanggal. Saldo awalnya
          diambil dari sebelum periode yang dipilih, bukan dimulai dari nol.
        </Typography>
      </div>
      <GeneralLedgerView />
    </div>
  );
}
