import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { MetalLotsView } from './_components/MetalLotsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MetalLotsPage() {
  try {
    await requirePermission('metal-lots:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Lot Logam</Typography>
        <Typography variant="muted">
          Batangan per keping, perhiasan per model, barang masuk yang belum dipilah, dan bal yang
          menunggu diolah — sisanya dihitung dari mutasi.
        </Typography>
      </div>
      <MetalLotsView />
    </div>
  );
}
