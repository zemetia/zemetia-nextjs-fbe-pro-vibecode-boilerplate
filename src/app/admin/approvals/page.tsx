import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requireAuth } from '@/lib/auth';
import { getUserPermissions, hasPermission } from '@/lib/rbac';
import { UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { ApprovalsView } from './_components/ApprovalsView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Inbox konfirmasi — satu antrean untuk seluruh modul.
 *
 * Gerbangnya **dua izin, bukan satu**: `approvals:list` untuk yang memutuskan
 * (direktur/owner melihat seluruh antrean) dan `approvals:request` untuk yang
 * mengajukan (petugas melihat pengajuannya sendiri dan hasilnya). Menutup
 * halaman ini dari pengaju akan membuat penolakan tidak punya tempat untuk
 * dibaca — dan penolakan yang tidak terbaca sama saja dengan dokumen yang
 * mengendap tanpa alasan.
 */
export default async function ApprovalsPage() {
  let canDecide = false;

  try {
    const session = await requireAuth();
    const permissions = await getUserPermissions(session.user.id);

    canDecide = hasPermission(permissions, 'approvals:list');
    if (!canDecide && !hasPermission(permissions, 'approvals:request')) redirect('/');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Konfirmasi Direktur</Typography>
        <Typography variant="muted">
          {canDecide
            ? 'Permintaan konfirmasi dari seluruh modul — pembelian, penerimaan barang, voucher keuangan, dan SPK produksi.'
            : 'Pengajuan konfirmasi yang Anda kirim beserta keputusannya.'}
        </Typography>
      </div>
      <ApprovalsView canDecide={canDecide} />
    </div>
  );
}
