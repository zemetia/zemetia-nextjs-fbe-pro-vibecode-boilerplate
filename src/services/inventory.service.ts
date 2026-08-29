import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatNumber } from '@/lib/number';
import {
  BAL_STAGE_LABELS,
  METAL_LOT_FORM_LABELS,
  positionShare,
} from '@/lib/metal-lot';
import { METAL_LABELS } from '@/lib/product';
import type {
  MetalLotDetailDTO,
  MetalLotDTO,
  MetalLotListDTO,
  StockPositionDTO,
} from '@/types/dtos';
import type {
  BalStage,
  Metal,
  MetalLotDetailVO,
  MetalLotForm,
  MetalLotListVO,
  MetalLotVO,
  StockPositionMetalVO,
  StockPositionVO,
} from '@/types/value-objects';

const EMPTY = '—';

const WEIGHT = { decimalScale: 4 } as const;

function gram(value: number): string {
  return `${formatNumber(value, WEIGHT)} g`;
}

function percent(value: number): string {
  return `${formatNumber(value, { decimalScale: 2 })}%`;
}

function pieces(count: number): string {
  return count > 0 ? `${formatNumber(count)} keping` : EMPTY;
}

// ── Lot emas ─────────────────────────────────────────────────────────────────

function identityOf(dto: MetalLotDTO): string {
  if (dto.form === 'BAR') return dto.serial_number ?? dto.code;
  return dto.code;
}

function toMetalLotVO(dto: MetalLotDTO): MetalLotVO {
  return {
    id: dto.id,
    code: dto.code,
    form: dto.form,
    formLabel: METAL_LOT_FORM_LABELS[dto.form],
    metal: dto.metal,
    metalLabel: METAL_LABELS[dto.metal],
    identityLabel: identityOf(dto),
    serialNumber: dto.serial_number ?? EMPTY,
    certificateNumber: dto.certificate_number ?? EMPTY,
    refinerName: dto.refiner_name ?? EMPTY,
    karat: dto.karat ?? undefined,
    karatLabel: dto.karat === null ? EMPTY : `${dto.karat}K`,
    stoneWeightGram: dto.stone_weight_gram ?? undefined,
    stoneWeightGramLabel: dto.stone_weight_gram === null ? EMPTY : gram(dto.stone_weight_gram),
    balStage: dto.bal_stage ?? undefined,
    balStageLabel: dto.bal_stage === null ? EMPTY : BAL_STAGE_LABELS[dto.bal_stage],
    assayedPurityPercent: dto.assayed_purity_percent ?? undefined,
    isPurityEstimated:
      (dto.form === 'BAL' || dto.form === 'SCRAP') && dto.assayed_purity_percent === null,
    purityPercent: dto.purity_percent,
    purityPercentLabel: percent(dto.assayed_purity_percent ?? dto.purity_percent),
    grossWeightGram: dto.gross_weight_gram,
    grossWeightGramLabel: gram(dto.gross_weight_gram),
    fineWeightGram: dto.fine_weight_gram,
    fineWeightGramLabel: gram(dto.fine_weight_gram),
    remainingGrossWeightGram: dto.remaining_gross_weight_gram,
    remainingGrossWeightGramLabel: gram(dto.remaining_gross_weight_gram),
    remainingFineWeightGram: dto.remaining_fine_weight_gram,
    remainingFineWeightGramLabel: gram(dto.remaining_fine_weight_gram),
    remainingPieceCount: dto.remaining_piece_count,
    remainingPieceCountLabel: pieces(dto.remaining_piece_count),
    isDepleted: dto.remaining_gross_weight_gram <= 0,
    sourceProductionOrderId: dto.source_production_order?.id,
    sourceProductionOrderNumber: dto.source_production_order?.number ?? EMPTY,
    notes: dto.notes ?? EMPTY,
    createdAt: dto.created_at,
  };
}

function toMetalLotDetailVO(dto: MetalLotDetailDTO): MetalLotDetailVO {
  return {
    ...toMetalLotVO(dto),
    createdByName: dto.created_by?.name ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type MetalLotListParams = ListParams & {
  form?: MetalLotForm;
  metal?: Metal;
  bal_stage?: BalStage;
  in_stock?: boolean;
};

export const metalLotService = {
  list: async (params?: MetalLotListParams): Promise<MetalLotListVO> =>
    toPaginatedVO(
      await apiClient.get<MetalLotListDTO>(`/api/metal-lots${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toMetalLotVO,
    ),

  detail: async (id: string): Promise<MetalLotDetailVO> =>
    toMetalLotDetailVO(
      await apiClient.get<MetalLotDetailDTO>(`/api/metal-lots/${id}`, { cache: 'no-store' }),
    ),
};

// ── Posisi stok ──────────────────────────────────────────────────────────────

function toStockPositionMetalVO(dto: StockPositionDTO['by_metal'][number]): StockPositionMetalVO {
  return {
    metal: dto.metal,
    metalLabel: METAL_LABELS[dto.metal],
    fineLabel: `${METAL_LABELS[dto.metal].toLowerCase()} murni`,
    totalFineGram: dto.total_fine_gram,
    totalFineGramLabel: gram(dto.total_fine_gram),
    totalGrossWeightGram: dto.total_gross_weight_gram,
    totalGrossWeightGramLabel: gram(dto.total_gross_weight_gram),
    lotCount: dto.lot_count,
    lotCountLabel: `${formatNumber(dto.lot_count)} lot`,
    openBalCount: dto.open_bal_count,
    openBalCountLabel: `${formatNumber(dto.open_bal_count)} bal`,
    byForm: dto.by_form.map((entry) => ({
      form: entry.form,
      formLabel: METAL_LOT_FORM_LABELS[entry.form],
      lotCount: entry.lot_count,
      lotCountLabel: `${formatNumber(entry.lot_count)} lot`,
      grossWeightGram: entry.gross_weight_gram,
      grossWeightGramLabel: gram(entry.gross_weight_gram),
      fineWeightGram: entry.fine_weight_gram,
      fineWeightGramLabel: gram(entry.fine_weight_gram),
      pieceCount: entry.piece_count,
      pieceCountLabel: pieces(entry.piece_count),
      sharePercent: positionShare(entry.fine_weight_gram, dto.total_fine_gram),
    })),
    isEmpty: dto.by_form.length === 0,
  };
}

function toStockPositionVO(dto: StockPositionDTO): StockPositionVO {
  const byMetal = dto.by_metal.map(toStockPositionMetalVO);

  return {
    byMetal,
    isEmpty: byMetal.every((entry) => entry.isEmpty),
  };
}

export const metalStockService = {
  positions: async (): Promise<StockPositionVO> =>
    toStockPositionVO(
      await apiClient.get<StockPositionDTO>('/api/metal-stock/positions', { cache: 'no-store' }),
    ),
};
