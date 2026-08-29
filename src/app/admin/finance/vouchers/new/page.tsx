import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { getUserPermissions, hasPermission, requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { VoucherForm } from '../_components/VoucherForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewCashVoucherPage() {
  let userId: string;

  try {
    const session = await requirePermission('cash-vouchers:create');
    userId = session.user.id;
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/finance/vouchers');
    throw error;
  }

  // Decides whether the "+" next to the partner picker is offered at all — the
  // partner endpoint re-checks it regardless.
  const canCreatePartner = hasPermission(await getUserPermissions(userId), 'partners:create');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/finance/vouchers"
          className="text-foreground-muted hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar voucher
        </Link>
        <div>
          <Typography variant="h2">Voucher Baru</Typography>
          <Typography variant="muted">
            Nomor voucher dibuat otomatis mengikuti jenis dan tanggalnya, dan tersimpan sebagai
            draft sampai diajukan.
          </Typography>
        </div>
      </div>

      <VoucherForm canCreatePartner={canCreatePartner} />
    </div>
  );
}
