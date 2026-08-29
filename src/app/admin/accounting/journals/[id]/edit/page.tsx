import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { JournalEditForm } from '../../_components/JournalEditForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function EditJournalPage({ params }: Params) {
  try {
    await requirePermission('journal-entries:update');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/accounting/journals');
    throw error;
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/accounting/journals"
          className="text-foreground-muted hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar jurnal
        </Link>
        <div>
          <Typography variant="h2">Ubah Draft Jurnal</Typography>
          <Typography variant="muted">
            Hanya draft jurnal manual yang bisa diubah. Barisnya diganti seluruhnya saat disimpan —
            sebuah jurnal hanya seimbang sebagai satu kesatuan.
          </Typography>
        </div>
      </div>

      <JournalEditForm entryId={id} />
    </div>
  );
}
