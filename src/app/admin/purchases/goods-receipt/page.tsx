import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermission } from '@/lib/rbac';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { Typography } from '@/components/ui/Typography';
import { GoodsReceiptView } from './_components/GoodsReceiptView';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GoodsReceiptPage() {
  try {
    await requirePermission('goods-receipts:list');
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) redirect('/admin');
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h2">Penerimaan Barang (TTB)</Typography>
        <Typography variant="muted">
          Konfirmasi barang diterima menjurnal ke buku besar — Debet akun persediaan produk, Kredit
          akun transit (bila menyusul keberangkatan) atau langsung ke 2110 Hutang Usaha (bila diserahkan
          di tempat).
        </Typography>
      </div>
      <GoodsReceiptView />
    </div>
  );
}
