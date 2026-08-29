import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { toSupplyDTO } from '@/lib/supply-dto';
import { updateSupplySchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('supplies:update');
    const { id } = await params;

    const existing = await prisma.supply.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Barang non-logam tidak ditemukan.');

    const body = updateSupplySchema.parse(await request.json());

    try {
      const supply = await prisma.supply.update({
        where: { id },
        data: {
          code: body.code,
          name: body.name,
          category: body.category ?? 'OTHER',
          unit: body.unit,
          lastPriceIdr: body.last_price_idr ?? null,
          notes: body.notes ?? null,
        },
      });

      return NextResponse.json(toSupplyDTO(supply));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Kode barang itu sudah dipakai barang lain.');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
