import { fromUtcDateOnly } from '@/lib/date';
import {
  isOverLossTolerance,
  lossPercentOf,
  materialPlan,
  yieldPercentOf,
} from '@/lib/production';
import type {
  ProductionBalance,
  ProductionOrderDetailRow,
  ProductionOrderRow,
} from '@/lib/production-write';
import type {
  ProductionBalanceDTO,
  ProductionOrderDetailDTO,
  ProductionOrderDTO,
} from '@/types/dtos';

export function toProductionBalanceDTO(
  balance: ProductionBalance,
  lossTolerancePercent: number,
): ProductionBalanceDTO {
  const lossPercent = lossPercentOf(balance.lossFineGram, balance.consumedFineGram);

  return {
    issued_fine_gram: balance.issuedFineGram,
    returned_fine_gram: balance.returnedFineGram,
    consumed_fine_gram: balance.consumedFineGram,
    output_fine_gram: balance.outputFineGram,
    output_gross_weight_gram: balance.outputGrossWeightGram,
    output_piece_count: balance.outputPieceCount,
    loss_fine_gram: balance.lossFineGram,
    alloy_gram: balance.alloyGram,
    wip_fine_gram: balance.wipFineGram,
    loss_percent: lossPercent,
    yield_percent: yieldPercentOf(balance.outputFineGram, balance.consumedFineGram),
    is_over_loss_tolerance: isOverLossTolerance(lossPercent, lossTolerancePercent),
  };
}

export function toProductionOrderDTO(
  row: ProductionOrderRow,
  balance: ProductionBalance,
): ProductionOrderDTO {
  const targetGross = Number(row.targetGrossWeightGram);
  const purity = Number(row.purityPercent);
  const plan = materialPlan(targetGross, purity);
  const tolerance = Number(row.lossTolerancePercent);

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    date: fromUtcDateOnly(row.date),
    target_date: row.targetDate === null ? null : fromUtcDateOnly(row.targetDate),

    model_name: row.modelName,
    karat: row.karat,
    purity_percent: purity,

    target_gross_weight_gram: targetGross,
    target_piece_count: row.targetPieceCount,
    fine_needed_gram: plan.fineNeededGram,
    alloy_needed_gram: plan.alloyNeededGram,

    location_name: row.locationName,
    loss_tolerance_percent: tolerance,

    balance: toProductionBalanceDTO(balance, tolerance),

    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}

export function toProductionOrderDetailDTO(
  row: ProductionOrderDetailRow,
  balance: ProductionBalance,
): ProductionOrderDetailDTO {
  return {
    ...toProductionOrderDTO(row, balance),
    close_note: row.closeNote,
    created_by: row.createdBy,
    released_by: row.releasedBy,
    released_at: row.releasedAt?.toISOString() ?? null,
    closed_by: row.closedBy,
    closed_at: row.closedAt?.toISOString() ?? null,
    voided_by: row.voidedBy,
    voided_at: row.voidedAt?.toISOString() ?? null,
    void_reason: row.voidReason,
    updated_at: row.updatedAt.toISOString(),
  };
}
