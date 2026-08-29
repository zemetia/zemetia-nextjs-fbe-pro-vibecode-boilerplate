import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { ProductionOrderDetailView } from '../_components/ProductionOrderDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePermission('production-orders:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/production');
    throw error;
  }

  const { id } = await params;

  return <ProductionOrderDetailView orderId={id} />;
}
