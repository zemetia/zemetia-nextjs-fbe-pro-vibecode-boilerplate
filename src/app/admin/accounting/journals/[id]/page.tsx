import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { JournalDetailView } from '../_components/JournalDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function JournalDetailPage({ params }: Params) {
  try {
    await requirePermission('journal-entries:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/accounting/journals');
    throw error;
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/accounting/journals"
        className="text-foreground-muted hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke daftar jurnal
      </Link>

      <JournalDetailView entryId={id} />
    </div>
  );
}
