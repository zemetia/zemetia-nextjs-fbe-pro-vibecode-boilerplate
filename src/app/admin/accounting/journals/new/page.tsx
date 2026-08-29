import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { JournalForm } from '../_components/JournalForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewJournalPage() {
  try {
    await requirePermission('journal-entries:create');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/accounting/journals');
    throw error;
  }

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
          <Typography variant="h2">Jurnal Manual Baru</Typography>
          <Typography variant="muted">
            Nomor jurnal dibuat otomatis saat tersimpan. Jurnalnya tersimpan sebagai draft dan belum
            dihitung buku besar sampai diposting.
          </Typography>
        </div>
      </div>

      <JournalForm />
    </div>
  );
}
