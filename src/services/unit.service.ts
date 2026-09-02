import { apiClient } from './client';
import { formatNumber } from '@/lib/number';
import type { UnitCategoryDTO, UnitConversionResponseDTO, UnitDTO } from '@/types/dtos';
import type { UnitCategoryVO, UnitConversionVO, UnitVO } from '@/types/value-objects';

function formatRatioLabels(conversionFactor: number, unitSymbol: string, anchorSymbol: string) {
  if (conversionFactor === 1) {
    return {
      toAnchor: `1 ${unitSymbol} = 1 ${anchorSymbol} (Anchor)`,
      fromAnchor: `1 ${anchorSymbol} = 1 ${unitSymbol}`,
    };
  }

  // 1 Unit = factor Anchor
  const toAnchor = `1 ${unitSymbol} = ${formatNumber(conversionFactor, { decimalScale: 8 })} ${anchorSymbol}`;

  // 1 Anchor = (1 / factor) Unit
  const unitsPerAnchor = conversionFactor !== 0 ? 1 / conversionFactor : 0;
  const fromAnchor = `1 ${anchorSymbol} = ${formatNumber(unitsPerAnchor, { decimalScale: 8 })} ${unitSymbol}`;

  return { toAnchor, fromAnchor };
}

export function toUnitVO(dto: UnitDTO, anchorSymbol = ''): UnitVO {
  const effectiveAnchorSymbol = anchorSymbol || (dto.is_anchor ? dto.symbol : 'Anchor');
  const { toAnchor, fromAnchor } = formatRatioLabels(
    dto.conversion_factor,
    dto.symbol,
    effectiveAnchorSymbol,
  );

  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    symbol: dto.symbol,
    label: `${dto.name} (${dto.symbol})`,
    categoryId: dto.category_id,
    categoryCode: dto.category_code ?? '',
    categoryName: dto.category_name ?? '',
    isAnchor: dto.is_anchor,
    conversionFactor: dto.conversion_factor,
    ratioToAnchorLabel: toAnchor,
    ratioFromAnchorLabel: fromAnchor,
    isActive: dto.is_active,
    statusLabel: dto.is_active ? 'Aktif' : 'Nonaktif',
    notes: dto.notes ?? '—',
  };
}

export function toCategoryVO(dto: UnitCategoryDTO): UnitCategoryVO {
  const anchorUnit = dto.units?.find((u) => u.is_anchor);
  const anchorSymbol = anchorUnit?.symbol ?? '';

  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description ?? '—',
    isActive: dto.is_active,
    anchorUnitId: dto.anchor_unit_id ?? anchorUnit?.id ?? null,
    anchorUnitName: dto.anchor_unit_name ?? anchorUnit?.name ?? null,
    units: (dto.units ?? []).map((u) => toUnitVO(u, anchorSymbol)),
  };
}

export function toConversionVO(dto: UnitConversionResponseDTO): UnitConversionVO {
  const anchorSymbol = dto.anchor_unit.symbol;
  return {
    fromValue: dto.from_value,
    fromUnit: toUnitVO(dto.from_unit, anchorSymbol),
    toUnit: toUnitVO(dto.to_unit, anchorSymbol),
    anchorUnit: toUnitVO(dto.anchor_unit, anchorSymbol),
    anchorValue: dto.anchor_value,
    resultValue: dto.result_value,
    formulaSummary: dto.formula_summary,
    ratioFromAnchor: dto.ratio_from_anchor,
    ratioToAnchor: dto.ratio_to_anchor,
    steps: dto.steps,
  };
}

const BASE = '/api/units';

export const unitService = {
  listCategories: async (): Promise<UnitCategoryVO[]> => {
    const dtos = await apiClient.get<UnitCategoryDTO[]>(`${BASE}/categories`, { cache: 'no-store' });
    return dtos.map(toCategoryVO);
  },

  listUnits: async (categoryCode?: string): Promise<UnitVO[]> => {
    const url = categoryCode ? `${BASE}?category=${encodeURIComponent(categoryCode)}` : BASE;
    const dtos = await apiClient.get<UnitDTO[]>(url, { cache: 'no-store' });
    return dtos.map((d) => toUnitVO(d));
  },

  createUnit: async (payload: {
    code: string;
    name: string;
    symbol: string;
    category_id: string;
    is_anchor?: boolean;
    conversion_factor: number;
    notes?: string;
  }): Promise<UnitVO> => {
    const dto = await apiClient.post<UnitDTO>(BASE, payload);
    return toUnitVO(dto);
  },

  convert: async (payload: {
    value: number;
    from_unit_code: string;
    to_unit_code: string;
  }): Promise<UnitConversionVO> => {
    const dto = await apiClient.post<UnitConversionResponseDTO>(`${BASE}/convert`, payload);
    return toConversionVO(dto);
  },
};
