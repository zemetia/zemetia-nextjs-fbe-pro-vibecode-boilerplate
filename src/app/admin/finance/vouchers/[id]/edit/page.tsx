import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { getUserPermissions, hasPermission, requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { VoucherEditForm } from '../../_components/VoucherEditForm';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function EditCashVoucherPage({ params }: Params) {
  let userId: string;

  try {
    const session = await requirePermission('cash-vouchers:update');
    userId = session.user.id;
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin/finance/vouchers');
    throw error;
  }

  const { id } = await params;
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
          <Typography variant="h2">Ubah Draft Voucher</Typography>
          <Typography variant="muted">
            Hanya draft yang bisa diubah. Nomor dan tanggalnya tetap seperti saat dibuat kecuali
            kamu menggantinya di sini.
          </Typography>
        </div>
      </div>

      <VoucherEditForm voucherId={id} canCreatePartner={canCreatePartner} />
    </div>
  );
}
