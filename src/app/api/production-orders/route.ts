import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  createProductionOrder,
  EMPTY_PRODUCTION_BALANCE,
  PRODUCTION_ORDER_INCLUDE,
  productionBalances,
} from '@/lib/production-write';
import { toProductionOrderDetailDTO, toProductionOrderDTO } from '@/lib/production-dto';
import { createProductionOrderSchema, productionOrderListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('production-orders:list');

    const query = parseListQuery(request, productionOrderListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.ProductionOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.model_name ? { modelName: query.model_name } : {}),
      ...(query.location_name ? { locationName: query.location_name } : {}),
      ...(query.date_from || query.date_to
        ? {
            date: {
              ...(query.date_from ? { gte: toUtcDateOnly(query.date_from) } : {}),
              ...(query.date_to ? { lte: toUtcDateOnly(query.date_to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { modelName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: PRODUCTION_ORDER_INCLUDE,
      }),
      prisma.productionOrder.count({ where }),
    ]);

    const balances = await productionBalances(rows.map((row) => row.id));

    return NextResponse.json(
      buildPaginatedDTO(rows, total, query, (row) =>
        toProductionOrderDTO(row, balances.get(row.id) ?? EMPTY_PRODUCTION_BALANCE),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('production-orders:create');
    const session = await requireAuth();

    const body = createProductionOrderSchema.parse(await request.json());

    const order = await createProductionOrder(
      {
        date: toUtcDateOnly(body.date),
        targetDate: body.target_date ? toUtcDateOnly(body.target_date) : null,
        modelName: body.model_name ?? null,
        karat: body.karat,
        targetGrossWeightGram: body.target_gross_weight_gram,
        targetPieceCount: body.target_piece_count ?? null,
        locationName: body.location_name ?? null,
        lossTolerancePercent: body.loss_tolerance_percent ?? 0,
        notes: body.notes ?? null,
      },
      session.user.id,
    );

    return NextResponse.json(
      toProductionOrderDetailDTO(order, EMPTY_PRODUCTION_BALANCE),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
