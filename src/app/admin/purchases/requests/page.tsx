import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { PurchaseRequestsView } from './_components/PurchaseRequestsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PurchaseRequestsPage() {
  try {
    await requirePermission('purchase-requests:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Permintaan Pembelian (PR)</Typography>
        <Typography variant="muted">
          Pengajuan kebutuhan barang logam mulia &amp; operasional divisi sebelum diterbitkan menjadi Purchase Order.
        </Typography>
      </div>
      <PurchaseRequestsView />
    </div>
  );
}
