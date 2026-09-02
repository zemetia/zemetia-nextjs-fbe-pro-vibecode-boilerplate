import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_ORDER_DETAIL_INCLUDE,
  toSalesOrderDetailDTO,
} from '@/lib/sales-dto';
import { confirmSalesOrder } from '@/lib/sales-write';

type Params = { params: Promise<{ id: string }> };

/** Menyetujui & mengunci harga SO ekspor — `DRAFT → CONFIRMED`. */
export async function PATCH(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-sales-orders:approve');
    const session = await requireAuth();
    const { id } = await params;

    const order = await prisma.salesOrder.findUnique({ where: { id, type: 'EXPORT' } });
    if (!order) throw new NotFoundError('Sales order ekspor yang dipilih tidak ditemukan.');

    await confirmSalesOrder(id, session.user.id, prisma);

    const updated = await prisma.salesOrder.findUnique({
      where: { id },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });
    if (!updated) throw new NotFoundError('Sales order ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesOrderDetailDTO(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
