import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { toUtcDateOnly } from '@/lib/date';
import {
  deleteProductionOrder,
  PRODUCTION_ORDER_DETAIL_INCLUDE,
  productionBalance,
  updateProductionOrder,
} from '@/lib/production-write';
import { toProductionOrderDetailDTO } from '@/lib/production-dto';
import { updateProductionOrderSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

async function detailResponse(id: string) {
  const [order, balance] = await Promise.all([
    prisma.productionOrder.findUnique({
      where: { id },
      include: PRODUCTION_ORDER_DETAIL_INCLUDE,
    }),
    productionBalance(id),
  ]);
  if (!order) throw new NotFoundError('SPK yang dipilih tidak ditemukan.');

  return NextResponse.json(toProductionOrderDetailDTO(order, balance));
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('production-orders:detail');
    const { id } = await params;

    return await detailResponse(id);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('production-orders:update');
    const { id } = await params;

    const body = updateProductionOrderSchema.parse(await request.json());

    const order = await updateProductionOrder(id, {
      date: toUtcDateOnly(body.date),
      targetDate: body.target_date ? toUtcDateOnly(body.target_date) : null,
      modelName: body.model_name ?? null,
      karat: body.karat,
      targetGrossWeightGram: body.target_gross_weight_gram,
      targetPieceCount: body.target_piece_count ?? null,
      locationName: body.location_name ?? null,
      lossTolerancePercent: body.loss_tolerance_percent ?? 0,
      notes: body.notes ?? null,
    });

    const balance = await productionBalance(order.id);

    return NextResponse.json(toProductionOrderDetailDTO(order, balance));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requirePermission('production-orders:delete');
    const { id } = await params;

    await deleteProductionOrder(id, session.user.id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
