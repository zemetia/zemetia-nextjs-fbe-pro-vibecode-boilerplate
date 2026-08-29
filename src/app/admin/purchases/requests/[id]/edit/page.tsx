import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import type { Route } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { PurchaseRequestEditForm } from '../../_components/PurchaseRequestEditForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditPurchaseRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePermission('purchase-requests:update');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/purchases/requests' as Route);
    throw error;
  }

  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/admin/purchases/requests/${id}` as Route}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke detail permintaan
        </Link>
        <div>
          <Typography variant="h2">Ubah Draft Permintaan (PR)</Typography>
          <Typography variant="muted">
            Hanya permintaan berstatus draft yang dapat diubah.
          </Typography>
        </div>
      </div>

      <PurchaseRequestEditForm id={id} />
    </div>
  );
}
