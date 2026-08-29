import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { AccountsTree } from './_components/AccountsTree';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountsPage() {
  try {
    await requirePermission('accounts:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Bagan Akun</Typography>
        <Typography variant="muted">
          Kode akun mengikuti posisinya di bagan: satu digit per tingkat, empat digit untuk tingkat
          1–4 dan lima digit untuk tingkat terdalam. Transaksi hanya bisa masuk ke akun yang belum
          punya turunan.
        </Typography>
      </div>
      <AccountsTree />
    </div>
  );
}
