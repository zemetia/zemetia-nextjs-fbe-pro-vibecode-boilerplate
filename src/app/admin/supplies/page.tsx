import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { SuppliesView } from './_components/SuppliesView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SuppliesPage() {
  try {
    await requirePermission('supplies:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Barang Non-Logam (Supplies)</Typography>
        <Typography variant="muted">
          Katalog bahan kimia refineri/lab, kowi lebur, sarung tangan, dan peralatan operasional non-emas.
        </Typography>
      </div>
      <SuppliesView />
    </div>
  );
}
