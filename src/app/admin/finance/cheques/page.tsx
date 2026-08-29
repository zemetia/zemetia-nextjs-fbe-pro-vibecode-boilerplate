import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { MasterChequeView } from './_components/MasterChequeView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MasterChequePage() {
  try {
    await requirePermission('cash-vouchers:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Master Buku Cek / Bilyet Giro</Typography>
        <Typography variant="muted">
          Registrasi buku cek/BG bank, kontrol batas plafon per lembar, dan pemantauan status
          lembar cek siap pakai atau menunggu kliring (Akun 2115).
        </Typography>
      </div>
      <MasterChequeView />
    </div>
  );
}
