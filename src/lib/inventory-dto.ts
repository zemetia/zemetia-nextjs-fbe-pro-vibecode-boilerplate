import type { Prisma } from '@prisma/client';

import type { LotBalance } from '@/lib/metal-stock';
import type {
  MetalLotDetailDTO,
  MetalLotDTO,
} from '@/types/dtos';

function decimal(value: Prisma.Decimal): number {
  return Number(value);
}

export const METAL_LOT_INCLUDE = {
  sourceProductionOrder: { select: { id: true, number: true } },
} as const;

export const METAL_LOT_DETAIL_INCLUDE = {
  ...METAL_LOT_INCLUDE,
  createdBy: { select: { id: true, name: true } },
} as const;

export type MetalLotRow = Prisma.MetalLotGetPayload<{ include: typeof METAL_LOT_INCLUDE }>;

export type MetalLotDetailRow = Prisma.MetalLotGetPayload<{
  include: typeof METAL_LOT_DETAIL_INCLUDE;
}>;

export function toMetalLotDTO(row: MetalLotRow, balance: LotBalance): MetalLotDTO {
  return {
    id: row.id,
    code: row.code,
    form: row.form,
    metal: row.metal,
    serial_number: row.serialNumber,
    certificate_number: row.certificateNumber,
    refiner_name: row.refinerName,
    karat: row.karat,
    piece_count: row.pieceCount,
    stone_weight_gram: row.stoneWeightGram === null ? null : decimal(row.stoneWeightGram),
    bal_stage: row.balStage,
    assayed_purity_percent:
      row.assayedPurityPercent === null ? null : decimal(row.assayedPurityPercent),
    purity_percent: decimal(row.purityPercent),
    gross_weight_gram: decimal(row.grossWeightGram),
    fine_weight_gram: decimal(row.fineWeightGram),
    remaining_gross_weight_gram: balance.grossWeightGram,
    remaining_fine_weight_gram: balance.fineWeightGram,
    remaining_piece_count: balance.pieceCount,
    source_production_order: row.sourceProductionOrder,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toMetalLotDetailDTO(
  row: MetalLotDetailRow,
  balance: LotBalance,
): MetalLotDetailDTO {
  return {
    ...toMetalLotDTO(row, balance),
    created_by: row.createdBy,
    updated_at: row.updatedAt.toISOString(),
  };
}
