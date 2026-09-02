import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_ORDER_DETAIL_INCLUDE,
  toSalesOrderDetailDTO,
} from '@/lib/sales-dto';
import { deleteSalesOrder } from '@/lib/sales-write';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('local-sales:detail');
    const { id } = await params;

    const order = await prisma.salesOrder.findUnique({
      where: { id, type: 'LOCAL' },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesOrderDetailDTO(order));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hanya draft yang boleh dihapus — confirmed di-void, bukan dihapus. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('local-sales:delete');
    const { id } = await params;

    const order = await prisma.salesOrder.findUnique({ where: { id, type: 'LOCAL' } });
    if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');

    await deleteSalesOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
