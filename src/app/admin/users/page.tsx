import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { UsersTable } from './_components/UsersTable';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function UsersPage() {
  try {
    await requirePermission('users:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Users</Typography>
        <Typography variant="muted">Setiap pengguna punya tepat satu role.</Typography>
      </div>
      <UsersTable />
    </div>
  );
}
