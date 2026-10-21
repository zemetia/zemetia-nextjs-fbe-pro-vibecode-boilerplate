import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { ImportPurchasesView } from './_components/ImportPurchasesView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ImportPurchasesPage() {
  try {
    await requirePermission('import-purchases:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">PO Emas Impor</Typography>
        <Typography variant="muted">
          Bisa merujuk Purchase Request emas impor yang sudah disetujui, atau dibuat langsung tanpa PR.
        </Typography>
      </div>
      <ImportPurchasesView />
    </div>
  );
}
