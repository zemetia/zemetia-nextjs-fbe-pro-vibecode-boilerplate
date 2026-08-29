import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { PartnersTable } from './_components/PartnersTable';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PartnersPage() {
  try {
    await requirePermission('partners:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Mitra Usaha</Typography>
        <Typography variant="muted">
          Semua lawan transaksi dalam satu daftar — badan usaha maupun perorangan, yang kita beli
          darinya, yang kita jual kepadanya, atau keduanya.
        </Typography>
      </div>
      <PartnersTable />
    </div>
  );
}
