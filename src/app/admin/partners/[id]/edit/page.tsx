import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import { PartnerEditForm } from '../../_components/PartnerEditForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('partners:update');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/partners');
    throw error;
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar partner
        </Link>
        <div>
          <Typography variant="h2">Ubah Partner</Typography>
          <Typography variant="muted">
            Kode partner tidak bisa diubah — dokumen pembelian lama merujuk padanya.
          </Typography>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PartnerEditForm partnerId={id} />
      </Suspense>
    </div>
  );
}
