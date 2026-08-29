import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import { toSupplyDTO } from '@/lib/supply-dto';
import { createSupplySchema, supplyListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('supplies:list');

    const query = parseListQuery(request, supplyListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.SupplyWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.is_active === undefined ? {} : { isActive: query.is_active }),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { name: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.supply.findMany({ where, skip, take, orderBy: { code: 'asc' } }),
      prisma.supply.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toSupplyDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Kodenya diketik, bukan dibuat sistem: `HNO3-68` adalah nama barang itu di rak
 * dan di surat pesanan, dan menerbitkan nomor sendiri di sebelahnya memberi satu
 * barang dua identitas.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('supplies:create');

    const body = createSupplySchema.parse(await request.json());

    try {
      const supply = await prisma.supply.create({
        data: {
          code: body.code,
          name: body.name,
          category: body.category ?? 'OTHER',
          unit: body.unit,
          lastPriceIdr: body.last_price_idr ?? null,
          notes: body.notes ?? null,
        },
      });

      return NextResponse.json(toSupplyDTO(supply), { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Kode barang itu sudah terdaftar. Pakai kode lain.');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
