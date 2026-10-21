import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { LocalPurchasesView } from './_components/LocalPurchasesView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LocalPurchasesPage() {
  try {
    await requirePermission('local-purchases:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">PO Emas Lokal</Typography>
        <Typography variant="muted">
          Pembelian emas dari mitra dalam negeri, tunai maupun tempo.
        </Typography>
      </div>
      <LocalPurchasesView />
    </div>
  );
}
