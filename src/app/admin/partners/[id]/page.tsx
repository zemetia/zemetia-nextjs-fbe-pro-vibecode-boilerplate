import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { PartnerDetailView } from './_components/PartnerDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('partners:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/partners');
    throw error;
  }

  const { id } = await params;
  return <PartnerDetailView partnerId={id} />;
}
