import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { StockPositionView } from './_components/StockPositionView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function InventoryPage() {
  try {
    await requirePermission('metal-lots:positions');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Posisi Logam</Typography>
        <Typography variant="muted">
          Berapa emas dan perak yang kita pegang, dalam bentuk apa, dan di mana — dihitung dari buku
          mutasi, bukan dari kolom saldo. Tiap logam berdiri sendiri: gramnya tidak pernah
          dijumlahkan.
        </Typography>
      </div>
      <StockPositionView />
    </div>
  );
}
