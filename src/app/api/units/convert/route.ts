import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { getConversionBreakdown, type UnitConversionParams } from '@/lib/unit-conversion';
import { convertUnitQuerySchema } from '@/lib/validations';
import type { UnitConversionResponseDTO, UnitDTO } from '@/types/dtos';

export async function POST(request: Request) {
  try {
    await requirePermission('units:convert');

    const body = convertUnitQuerySchema.parse(await request.json());

    // Cari fromUnit dan toUnit
    const [fromUnit, toUnit] = await Promise.all([
      prisma.unit.findUnique({
        where: { code: body.from_unit_code },
        include: { category: true },
      }),
      prisma.unit.findUnique({
        where: { code: body.to_unit_code },
        include: { category: true },
      }),
    ]);

    if (!fromUnit) {
      throw new NotFoundError(`Satuan asal dengan kode "${body.from_unit_code}" tidak ditemukan`);
    }

    if (!toUnit) {
      throw new NotFoundError(`Satuan tujuan dengan kode "${body.to_unit_code}" tidak ditemukan`);
    }

    if (fromUnit.categoryId !== toUnit.categoryId) {
      throw new ValidationError(
        `Tidak dapat mengonversi satuan berbeda tipe (${fromUnit.category.name} vs ${toUnit.category.name})`,
      );
    }

    // Cari anchor unit dari kategori yang sama
    const anchorUnit = await prisma.unit.findFirst({
      where: { categoryId: fromUnit.categoryId, isAnchor: true },
      include: { category: true },
    });

    if (!anchorUnit) {
      throw new NotFoundError(`Satuan Anchor untuk kategori ${fromUnit.category.name} belum ditentukan`);
    }

    const fromParams: UnitConversionParams = {
      code: fromUnit.code,
      name: fromUnit.name,
      symbol: fromUnit.symbol,
      categoryCode: fromUnit.category.code,
      isAnchor: fromUnit.isAnchor,
      conversionFactor: Number(fromUnit.conversionFactor),
    };

    const toParams: UnitConversionParams = {
      code: toUnit.code,
      name: toUnit.name,
      symbol: toUnit.symbol,
      categoryCode: toUnit.category.code,
      isAnchor: toUnit.isAnchor,
      conversionFactor: Number(toUnit.conversionFactor),
    };

    const anchorParams: UnitConversionParams = {
      code: anchorUnit.code,
      name: anchorUnit.name,
      symbol: anchorUnit.symbol,
      categoryCode: anchorUnit.category.code,
      isAnchor: anchorUnit.isAnchor,
      conversionFactor: Number(anchorUnit.conversionFactor),
    };

    const breakdown = getConversionBreakdown(body.value, fromParams, toParams, anchorParams);

    const toDTO = (u: typeof fromUnit): UnitDTO => ({
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
    });

    const response: UnitConversionResponseDTO = {
      from_value: breakdown.fromValue,
      from_unit: toDTO(fromUnit),
      to_unit: toDTO(toUnit),
      anchor_unit: toDTO(anchorUnit),
      anchor_value: breakdown.anchorValue,
      result_value: breakdown.resultValue,
      formula_summary: breakdown.formulaSummary,
      ratio_from_anchor: breakdown.ratioFromAnchor,
      ratio_to_anchor: breakdown.ratioToAnchor,
      steps: [...breakdown.steps],
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
