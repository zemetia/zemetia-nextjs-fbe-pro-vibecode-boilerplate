import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatNumber, roundTo } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  acceptsMetalMovement,
  canCloseProductionOrder,
  canReleaseProductionOrder,
  canVoidProductionOrder,
  isProductionOrderEditable,
  PRODUCTION_ORDER_STATUS_LABELS,
} from '@/lib/production';
import type {
  ProductionBalanceDTO,
  ProductionOrderDetailDTO,
  ProductionOrderDTO,
  ProductionOrderListDTO,
} from '@/types/dtos';
import type {
  ProductionBalanceVO,
  ProductionOrderDetailVO,
  ProductionOrderListVO,
  ProductionOrderStatus,
  ProductionOrderVO,
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

function toProductionBalanceVO(dto: ProductionBalanceDTO): ProductionBalanceVO {
  return {
    issuedFineGram: dto.issued_fine_gram,
    issuedFineGramLabel: gram(dto.issued_fine_gram),
    returnedFineGram: dto.returned_fine_gram,
    returnedFineGramLabel: gram(dto.returned_fine_gram),
    consumedFineGram: dto.consumed_fine_gram,
    consumedFineGramLabel: gram(dto.consumed_fine_gram),
    outputFineGram: dto.output_fine_gram,
    outputFineGramLabel: gram(dto.output_fine_gram),
    outputGrossWeightGram: dto.output_gross_weight_gram,
    outputGrossWeightGramLabel: gram(dto.output_gross_weight_gram),
    outputPieceCount: dto.output_piece_count,
    outputPieceCountLabel: pieces(dto.output_piece_count),
    lossFineGram: dto.loss_fine_gram,
    lossFineGramLabel: gram(dto.loss_fine_gram),
    alloyGram: dto.alloy_gram,
    alloyGramLabel: gram(dto.alloy_gram),
    wipFineGram: dto.wip_fine_gram,
    wipFineGramLabel: gram(dto.wip_fine_gram),
    lossPercent: dto.loss_percent,
    lossPercentLabel: percent(dto.loss_percent),
    yieldPercent: dto.yield_percent,
    yieldPercentLabel: percent(dto.yield_percent),
    isOverLossTolerance: dto.is_over_loss_tolerance,
    hasMaterialOnFloor: dto.wip_fine_gram > 0,
  };
}

function progressOf(dto: ProductionOrderDTO): number {
  if (dto.target_gross_weight_gram <= 0) return 0;

  return roundTo(
    Math.min(100, (dto.balance.output_gross_weight_gram / dto.target_gross_weight_gram) * 100),
    2,
  );
}

function toProductionOrderVO(dto: ProductionOrderDTO): ProductionOrderVO {
  const status: ProductionOrderStatus = dto.status;

  return {
    id: dto.id,
    number: dto.number,
    status,
    statusLabel: PRODUCTION_ORDER_STATUS_LABELS[status],
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    targetDate: dto.target_date ?? undefined,
    targetDateLabel: dto.target_date === null ? EMPTY : formatDateShort(dto.target_date),

    modelName: dto.model_name ?? EMPTY,
    karat: dto.karat,
    karatLabel: `${dto.karat}K`,
    purityPercent: dto.purity_percent,
    purityPercentLabel: percent(dto.purity_percent),

    targetGrossWeightGram: dto.target_gross_weight_gram,
    targetGrossWeightGramLabel: gram(dto.target_gross_weight_gram),
    targetPieceCount: dto.target_piece_count ?? undefined,
    targetPieceCountLabel: dto.target_piece_count === null ? EMPTY : pieces(dto.target_piece_count),
    fineNeededGram: dto.fine_needed_gram,
    fineNeededGramLabel: gram(dto.fine_needed_gram),
    alloyNeededGram: dto.alloy_needed_gram,
    alloyNeededGramLabel: gram(dto.alloy_needed_gram),

    locationName: dto.location_name ?? EMPTY,
    lossTolerancePercent: dto.loss_tolerance_percent,
    lossTolerancePercentLabel: percent(dto.loss_tolerance_percent),

    balance: toProductionBalanceVO(dto.balance),
    progressPercent: progressOf(dto),

    isEditable: isProductionOrderEditable(status),
    canRelease: canReleaseProductionOrder(status),
    canRecordMovement: acceptsMetalMovement(status),
    canClose: canCloseProductionOrder(status),
    canVoid: canVoidProductionOrder(status),

    notes: dto.notes ?? EMPTY,
    createdAt: dto.created_at,
  };
}

function toProductionOrderDetailVO(dto: ProductionOrderDetailDTO): ProductionOrderDetailVO {
  return {
    ...toProductionOrderVO(dto),
    closeNote: dto.close_note ?? EMPTY,
    createdByName: dto.created_by?.name ?? EMPTY,
    releasedByName: dto.released_by?.name ?? EMPTY,
    releasedAt: dto.released_at ?? undefined,
    closedByName: dto.closed_by?.name ?? EMPTY,
    closedAt: dto.closed_at ?? undefined,
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAt: dto.voided_at ?? undefined,
    voidReason: dto.void_reason ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type ProductionOrderListParams = ListParams & {
  status?: ProductionOrderStatus;
  model_name?: string;
  location_name?: string;
  date_from?: string;
  date_to?: string;
};

export type ProductionOrderWritePayload = {
  date: string;
  target_date?: string;
  model_name?: string;
  karat: number;
  target_gross_weight_gram: number;
  target_piece_count?: number;
  location_name?: string;
  loss_tolerance_percent?: number;
  notes?: string;
};

export type MaterialLinePayload = {
  lot_id: string;
  gross_weight_gram: number;
};

export type IssueMaterialPayload = {
  date: string;
  source_location_id: string;
  lines: MaterialLinePayload[];
  notes?: string;
};

export type ReturnMaterialPayload = {
  date: string;
  destination_location_id: string;
  lines: MaterialLinePayload[];
  notes?: string;
};

export type ProductionOutputPayload = {
  date: string;
  consumption: MaterialLinePayload[];
  jewelry?: {
    jewelry_model_id: string;
    karat: number;
    piece_count: number;
    gross_weight_gram: number;
    stone_weight_gram?: number;
    notes?: string;
  }[];
  scrap?: {
    gross_weight_gram: number;
    purity_percent: number;
    notes?: string;
  }[];
  loss_fine_gram?: number;
  alloy_gram?: number;
  notes?: string;
};

const BASE = '/api/production-orders';

/**
 * Every write returns the whole order, not the document it just wrote: what the
 * clerk needs to see next is how much material this order now holds, and that
 * only exists once the movement is posted.
 */
export const productionOrderService = {
  list: async (params?: ProductionOrderListParams): Promise<ProductionOrderListVO> =>
    toPaginatedVO(
      await apiClient.get<ProductionOrderListDTO>(`${BASE}${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toProductionOrderVO,
    ),

  detail: async (id: string): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.get<ProductionOrderDetailDTO>(`${BASE}/${id}`, { cache: 'no-store' }),
    ),

  create: async (payload: ProductionOrderWritePayload): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(await apiClient.post<ProductionOrderDetailDTO>(BASE, payload)),

  update: async (
    id: string,
    payload: ProductionOrderWritePayload,
  ): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.patch<ProductionOrderDetailDTO>(`${BASE}/${id}`, payload),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`${BASE}/${id}`);
  },

  release: async (id: string): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.patch<ProductionOrderDetailDTO>(`${BASE}/${id}/status`, {
        status: 'RELEASED',
      }),
    ),

  close: async (id: string, closeNote?: string): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.patch<ProductionOrderDetailDTO>(`${BASE}/${id}/status`, {
        status: 'CLOSED',
        ...(closeNote ? { close_note: closeNote } : {}),
      }),
    ),

  void: async (id: string, voidReason: string): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.patch<ProductionOrderDetailDTO>(`${BASE}/${id}/status`, {
        status: 'VOID',
        void_reason: voidReason,
      }),
    ),

  issueMaterial: async (
    id: string,
    payload: IssueMaterialPayload,
  ): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.post<ProductionOrderDetailDTO>(`${BASE}/${id}/issues`, payload),
    ),

  returnMaterial: async (
    id: string,
    payload: ReturnMaterialPayload,
  ): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.post<ProductionOrderDetailDTO>(`${BASE}/${id}/returns`, payload),
    ),

  receiveOutput: async (
    id: string,
    payload: ProductionOutputPayload,
  ): Promise<ProductionOrderDetailVO> =>
    toProductionOrderDetailVO(
      await apiClient.post<ProductionOrderDetailDTO>(`${BASE}/${id}/receipts`, payload),
    ),
};
