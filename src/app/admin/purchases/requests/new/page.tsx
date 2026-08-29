import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { PurchaseRequestForm } from '../_components/PurchaseRequestForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewPurchaseRequestPage() {
  try {
    await requirePermission('purchase-requests:create');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Buat Permintaan Pembelian (PR)</Typography>
        <Typography variant="muted">
          Ajukan kebutuhan pengadaan barang untuk persetujuan atasan/kepala divisi.
        </Typography>
      </div>
      <PurchaseRequestForm />
    </div>
  );
}
