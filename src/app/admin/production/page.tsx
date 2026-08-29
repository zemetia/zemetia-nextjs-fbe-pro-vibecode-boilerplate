import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { ProductionOrdersView } from './_components/ProductionOrdersView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProductionOrdersPage() {
  try {
    await requirePermission('production-orders:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">SPK Produksi</Typography>
        <Typography variant="muted">
          Rencana pengerjaan perhiasan — berapa emas yang diminta, berapa yang sudah jadi barang, dan
          berapa yang masih di tangan produksi.
        </Typography>
      </div>
      <ProductionOrdersView />
    </div>
  );
}
