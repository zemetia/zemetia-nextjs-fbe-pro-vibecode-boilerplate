import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import { balanceOf, lotBalances } from '@/lib/metal-stock';
import { METAL_LOT_INCLUDE, toMetalLotDTO, type MetalLotRow } from '@/lib/inventory-dto';
import { metalLotListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('metal-lots:list');

    const query = parseListQuery(request, metalLotListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.MetalLotWhereInput = {
      ...(query.form ? { form: query.form } : {}),
      ...(query.metal ? { metal: query.metal } : {}),
      ...(query.bal_stage ? { balStage: query.bal_stage } : {}),
      ...(query.in_stock ? { grossWeightGram: { gt: 0 } } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { serialNumber: { contains: query.q, mode: 'insensitive' as const } },
              { certificateNumber: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.metalLot.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { code: 'desc' }],
        include: METAL_LOT_INCLUDE,
      }),
      prisma.metalLot.count({ where }),
    ]);

    const balances = await lotBalances(rows.map((row) => row.id));

    return NextResponse.json(
      buildPaginatedDTO(rows, total, query, (row: MetalLotRow) =>
        toMetalLotDTO(row, balanceOf(balances, row.id)),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
