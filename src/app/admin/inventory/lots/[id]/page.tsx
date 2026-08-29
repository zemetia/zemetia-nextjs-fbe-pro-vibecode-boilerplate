import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { MetalLotDetailView } from './_components/MetalLotDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function MetalLotDetailPage({ params }: Params) {
  try {
    await requirePermission('metal-lots:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  const { id } = await params;

  return <MetalLotDetailView lotId={id} />;
}
