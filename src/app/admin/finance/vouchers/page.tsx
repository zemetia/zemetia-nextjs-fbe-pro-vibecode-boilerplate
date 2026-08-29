import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { VouchersView } from './_components/VouchersView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CashVouchersPage() {
  try {
    await requirePermission('cash-vouchers:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Voucher Keuangan</Typography>
        <Typography variant="muted">
          Bukti kas dan bank (BKK, BKM, BBK, BBM) beserta bukti memorial — satu daftar, disaring per
          jenis.
        </Typography>
      </div>
      <VouchersView />
    </div>
  );
}
