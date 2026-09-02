import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import type { UnitCategoryDTO, UnitDTO } from '@/types/dtos';

export async function GET() {
  try {
    await requirePermission('units:list');

    const categories = await prisma.unitCategory.findMany({
      where: { isActive: true },
      include: {
        units: {
          where: { isActive: true },
          orderBy: [{ isAnchor: 'desc' }, { code: 'asc' }],
        },
      },
      orderBy: { code: 'asc' },
    });

    const dtos: UnitCategoryDTO[] = categories.map((cat) => {
      const anchorUnit = cat.units.find((u) => u.isAnchor);
      const units: UnitDTO[] = cat.units.map((u) => ({
        id: u.id,
        code: u.code,
        name: u.name,
        symbol: u.symbol,
        category_id: u.categoryId,
        category_code: cat.code,
        category_name: cat.name,
        is_anchor: u.isAnchor,
        conversion_factor: Number(u.conversionFactor),
        is_active: u.isActive,
        notes: u.notes,
      }));

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        description: cat.description,
        is_active: cat.isActive,
        anchor_unit_id: anchorUnit?.id ?? null,
        anchor_unit_name: anchorUnit?.name ?? null,
        units,
      };
    });

    return NextResponse.json(dtos);
  } catch (error) {
    return handleApiError(error);
  }
}
