import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import { PartnerWizard } from '../_components/PartnerWizard';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewPartnerPage() {
  try {
    await requirePermission('partners:create');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/partners');
    throw error;
  }

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
          <Typography variant="h2">Partner Baru</Typography>
          <Typography variant="muted">
            Kode partner dibuat otomatis setelah disimpan. Hanya identitas yang wajib diisi.
          </Typography>
        </div>
      </div>

      {/* The wizard reads its step from the URL — Suspense keeps that off the
          prerender path. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PartnerWizard />
      </Suspense>
    </div>
  );
}
