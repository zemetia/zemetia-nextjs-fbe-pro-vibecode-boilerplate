import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { UnitsView } from './_components/UnitsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function UnitsPage() {
  try {
    await requirePermission('units:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return <UnitsView />;
}
