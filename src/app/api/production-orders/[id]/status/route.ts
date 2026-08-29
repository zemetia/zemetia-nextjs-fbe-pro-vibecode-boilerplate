import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import {
  closeProductionOrder,
  productionBalance,
  releaseProductionOrder,
  voidProductionOrder,
  type ProductionOrderDetailRow,
} from '@/lib/production-write';
import { toProductionOrderDetailDTO } from '@/lib/production-dto';
import { setProductionOrderStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setProductionOrderStatusSchema.parse(await request.json());

    await requirePermission(
      body.status === 'RELEASED'
        ? 'production-orders:release'
        : body.status === 'CLOSED'
          ? 'production-orders:close'
          : 'production-orders:void',
    );
    const session = await requireAuth();

    let order: ProductionOrderDetailRow;

    if (body.status === 'RELEASED') {
      order = await releaseProductionOrder(id, session.user.id);
    } else if (body.status === 'CLOSED') {
      order = await closeProductionOrder(id, session.user.id, body.close_note ?? null);
    } else {
      order = await voidProductionOrder(id, session.user.id, body.void_reason);
    }

    const balance = await productionBalance(order.id);

    return NextResponse.json(toProductionOrderDetailDTO(order, balance));
  } catch (error) {
    return handleApiError(error);
  }
}
