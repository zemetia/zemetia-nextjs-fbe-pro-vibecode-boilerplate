import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { RolesTable } from './_components/RolesTable';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function RolesPage() {
  try {
    await requirePermission('roles:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Roles</Typography>
        <Typography variant="muted">Kelola role dan izin yang dimilikinya.</Typography>
      </div>
      <RolesTable />
    </div>
  );
}
