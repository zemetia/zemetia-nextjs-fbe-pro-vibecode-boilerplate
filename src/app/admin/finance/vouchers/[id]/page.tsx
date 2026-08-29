import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { VoucherDetailView } from '../_components/VoucherDetailView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function CashVoucherDetailPage({ params }: Params) {
  try {
    await requirePermission('cash-vouchers:detail');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/finance/vouchers');
    throw error;
  }

  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/finance/vouchers"
        className="text-foreground-muted hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke daftar voucher
      </Link>

      <VoucherDetailView voucherId={id} />
    </div>
  );
}
