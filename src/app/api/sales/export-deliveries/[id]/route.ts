import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_DELIVERY_DETAIL_INCLUDE,
  toSalesDeliveryDetailDTO,
} from '@/lib/sales-dto';
import { deleteSalesDelivery } from '@/lib/sales-write';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-deliveries:detail');
    const { id } = await params;

    const delivery = await prisma.salesDelivery.findUnique({
      where: { id, order: { type: 'EXPORT' } },
      include: SALES_DELIVERY_DETAIL_INCLUDE,
    });
    if (!delivery) throw new NotFoundError('Surat jalan ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesDeliveryDetailDTO(delivery));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hanya draft yang boleh dihapus — confirmed di-void, bukan dihapus. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-deliveries:delete');
    const { id } = await params;

    const delivery = await prisma.salesDelivery.findUnique({
      where: { id, order: { type: 'EXPORT' } },
    });
    if (!delivery) throw new NotFoundError('Surat jalan ekspor yang dipilih tidak ditemukan.');

    await deleteSalesDelivery(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
