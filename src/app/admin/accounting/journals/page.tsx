import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { JournalsView } from './_components/JournalsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function JournalsPage() {
  try {
    await requirePermission('journal-entries:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Jurnal Umum</Typography>
        <Typography variant="muted">
          Seluruh jurnal dari semua modul — pembelian, penjualan, produksi, voucher — beserta yang
          diketik manual. Draft belum dihitung saldo; yang dihitung hanya yang sudah diposting.
        </Typography>
      </div>
      <JournalsView />
    </div>
  );
}
