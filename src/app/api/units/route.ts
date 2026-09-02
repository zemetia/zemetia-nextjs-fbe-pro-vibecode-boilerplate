import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isUniqueViolation } from '@/lib/prisma-error';
import { requirePermission } from '@/lib/rbac';
import { createUnitSchema } from '@/lib/validations';
import type { UnitDTO } from '@/types/dtos';

export async function GET(request: Request) {
  try {
    await requirePermission('units:list');

    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');

    const units = await prisma.unit.findMany({
      where: {
        isActive: true,
        ...(categoryCode ? { category: { code: categoryCode } } : {}),
      },
      include: {
        category: true,
      },
      orderBy: [{ category: { code: 'asc' } }, { isAnchor: 'desc' }, { code: 'asc' }],
    });

    const dtos: UnitDTO[] = units.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      symbol: u.symbol,
      category_id: u.categoryId,
      category_code: u.category.code,
      category_name: u.category.name,
      is_anchor: u.isAnchor,
      conversion_factor: Number(u.conversionFactor),
      is_active: u.isActive,
      notes: u.notes,
    }));

    return NextResponse.json(dtos);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('units:create');

    const body = createUnitSchema.parse(await request.json());

    const category = await prisma.unitCategory.findUnique({
      where: { id: body.category_id },
    });

    if (!category) {
      throw new NotFoundError('Kategori tipe satuan yang dipilih tidak ditemukan');
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        // Jika satuan ini ditandai sebagai anchor, lepas anchor dari satuan lain dalam kategori ini
        if (body.is_anchor) {
          await tx.unit.updateMany({
            where: { categoryId: body.category_id, isAnchor: true },
            data: { isAnchor: false },
          });
        }

        return tx.unit.create({
          data: {
            code: body.code,
            name: body.name,
            symbol: body.symbol,
            categoryId: body.category_id,
            isAnchor: body.is_anchor,
            conversionFactor: body.is_anchor ? 1 : body.conversion_factor,
            notes: body.notes ?? null,
          },
          include: {
            category: true,
          },
        });
      });

      const dto: UnitDTO = {
        id: created.id,
        code: created.code,
        name: created.name,
        symbol: created.symbol,
        category_id: created.categoryId,
        category_code: created.category.code,
        category_name: created.category.name,
        is_anchor: created.isAnchor,
        conversion_factor: Number(created.conversionFactor),
        is_active: created.isActive,
        notes: created.notes,
      };

      return NextResponse.json(dto, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Kode satuan itu sudah terdaftar. Gunakan kode lain.');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
