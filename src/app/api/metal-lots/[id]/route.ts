import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { balanceOf, lotBalances } from '@/lib/metal-stock';
import { METAL_LOT_DETAIL_INCLUDE, toMetalLotDetailDTO } from '@/lib/inventory-dto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('metal-lots:detail');
    const { id } = await params;

    const lot = await prisma.metalLot.findUnique({
      where: { id },
      include: METAL_LOT_DETAIL_INCLUDE,
    });
    if (!lot) throw new NotFoundError('Lot emas tidak ditemukan.');

    const balances = await lotBalances([lot.id]);

    return NextResponse.json(
      toMetalLotDetailDTO(lot, balanceOf(balances, lot.id)),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
