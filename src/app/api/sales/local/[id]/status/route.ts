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
import { confirmSalesOrder, voidSalesOrder } from '@/lib/sales-write';
import { voidSalesOrderSchema } from '@/lib/validations';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const setStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('CONFIRMED') }),
  z.object({ status: z.literal('VOID') }).extend(voidSalesOrderSchema.shape),
]);

/** `DRAFT → CONFIRMED → VOID`. Konfirmasi SO tidak menjurnal — komitmen. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setStatusSchema.parse(await request.json());

    await requirePermission(body.status === 'VOID' ? 'local-sales:void' : 'local-sales:confirm');
    const session = await requireAuth();

    const order = await prisma.salesOrder.findUnique({ where: { id, type: 'LOCAL' } });
    if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');

    if (body.status === 'CONFIRMED') {
      await confirmSalesOrder(id, session.user.id, prisma);
    } else {
      await voidSalesOrder(id, session.user.id, body.void_reason, prisma);
    }

    const updated = await prisma.salesOrder.findUnique({
      where: { id },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });
    if (!updated) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesOrderDetailDTO(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
