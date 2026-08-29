import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { ProductionOrderEditForm } from '../../_components/ProductionOrderEditForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditProductionOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePermission('production-orders:update');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/production');
    throw error;
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/production"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar SPK
        </Link>
        <div>
          <Typography variant="h2">Ubah Draft SPK</Typography>
          <Typography variant="muted">
            Hanya draft yang bisa diubah — SPK yang sudah dirilis dikoreksi lewat pembatalan.
          </Typography>
        </div>
      </div>

      <ProductionOrderEditForm orderId={id} />
    </div>
  );
}
