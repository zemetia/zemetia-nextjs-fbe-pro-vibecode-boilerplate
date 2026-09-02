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
import { voidSalesOrder } from '@/lib/sales-write';
import { voidSalesOrderSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('export-sales-orders:void');
    const session = await requireAuth();
    const { id } = await params;

    const body = voidSalesOrderSchema.parse(await request.json());

    const order = await prisma.salesOrder.findUnique({ where: { id, type: 'EXPORT' } });
    if (!order) throw new NotFoundError('Sales order ekspor yang dipilih tidak ditemukan.');

    await voidSalesOrder(id, session.user.id, body.void_reason, prisma);

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
