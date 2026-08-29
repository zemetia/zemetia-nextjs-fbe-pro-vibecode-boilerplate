import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { PurchaseRequestDetailView } from '../_components/PurchaseRequestDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePermission('purchase-requests:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/purchases/requests' as Route);
    throw error;
  }

  const { id } = await params;

  return <PurchaseRequestDetailView id={id} />;
}
