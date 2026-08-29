import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatDateShort } from '@/lib/date';
import { formatNumber } from '@/lib/number';
import {
  canApprovePurchaseRequest,
  canConvertPurchaseRequest,
  canDeletePurchaseRequest,
  canVoidPurchaseRequest,
  isPurchaseRequestEditable,
  purchaseRequestStage,
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PURCHASE_REQUEST_PRIORITY_LABELS,
  PURCHASE_REQUEST_STAGE_LABELS,
} from '@/lib/purchase-request';
import { displayWeight, WEIGHT_SCALE } from '@/lib/weight';
import type {
  PurchaseRequestDetailDTO,
  PurchaseRequestDTO,
  PurchaseRequestItemDTO,
  PurchaseRequestListDTO,
} from '@/types/dtos';
import type {
  PurchaseRequestCategory,
  PurchaseRequestDetailVO,
  PurchaseRequestItemVO,
  PurchaseRequestListVO,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
  PurchaseRequestVO,
} from '@/types/value-objects';

const EMPTY = '—';

/** Suffix satuan berat — sama dengan yang dipakai dokumen pembeliannya. */
const UNIT_SUFFIX = { GRAM: 'g', TROY_OUNCE: 'oz' } as const;

/**
 * Jumlah baris, **dinyatakan kembali dalam satuan yang dipakai mengetiknya**.
 * Kolomnya menyimpan gram; baris yang diminta 400 oz dibaca lagi sebagai 400 oz,
 * bukan 12.441,3907 g yang harus dibagi sendiri di kepala.
 *
 * Baris supply tidak punya satuan berat — satuannya ikut masternya dan angkanya
 * dipakai apa adanya.
 */
function quantityLabel(item: PurchaseRequestItemDTO, value: number): string {
  if (item.weight_unit) {
    return `${formatNumber(displayWeight(value, item.weight_unit), { decimalScale: WEIGHT_SCALE })} ${UNIT_SUFFIX[item.weight_unit]}`;
  }

  return `${formatNumber(value, { decimalScale: 2 })} ${item.supply?.unit ?? ''}`.trim();
}

function unitLabelOf(item: PurchaseRequestItemDTO): string {
  if (item.weight_unit) return UNIT_SUFFIX[item.weight_unit];
  return item.supply?.unit ?? EMPTY;
}

function toItemVO(item: PurchaseRequestItemDTO, currencyCode: string): PurchaseRequestItemVO {
  const money = (value: number) =>
    `${currencyCode} ${formatNumber(value, { decimalScale: 2 })}`;

  return {
    id: item.id,
    lineNo: item.line_no,
    itemLabel: item.product?.name ?? item.supply?.name ?? EMPTY,
    itemCode: item.product?.code ?? item.supply?.code ?? EMPTY,
    productId: item.product?.id,
    supplyId: item.supply?.id,
    metal: item.product?.metal,
    form: item.product?.form,
    supplyCategory: item.supply?.category,
    weightUnit: item.weight_unit ?? undefined,
    unitLabel: unitLabelOf(item),
    quantity: item.quantity,
    quantityLabel: quantityLabel(item, item.quantity),
    estUnitPrice: item.est_unit_price,
    estUnitPriceLabel: money(item.est_unit_price),
    estAmount: item.est_amount,
    estAmountLabel: money(item.est_amount),
    orderedQuantity: item.ordered_quantity,
    orderedQuantityLabel: quantityLabel(item, item.ordered_quantity),
    outstandingQuantity: item.outstanding_quantity,
    outstandingQuantityLabel: quantityLabel(item, item.outstanding_quantity),
    isFulfilled: item.outstanding_quantity <= 0,
    notes: item.notes ?? EMPTY,
  };
}

function toVO(dto: PurchaseRequestDTO): PurchaseRequestVO {
  const status: PurchaseRequestStatus = dto.status;
  const category: PurchaseRequestCategory = dto.category;
  const priority: PurchaseRequestPriority = dto.priority;
  const stage = purchaseRequestStage(status, dto.is_fulfilled);

  return {
    id: dto.id,
    number: dto.number,
    status,
    stage,
    stageLabel: PURCHASE_REQUEST_STAGE_LABELS[stage],
    category,
    categoryLabel: PURCHASE_REQUEST_CATEGORY_LABELS[category],
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    requiredDate: dto.required_date ?? undefined,
    requiredDateLabel: dto.required_date === null ? EMPTY : formatDateShort(dto.required_date),
    department: dto.department,
    priority,
    priorityLabel: PURCHASE_REQUEST_PRIORITY_LABELS[priority],
    isUrgent: priority === 'URGENT',
    suggestedPartnerId: dto.suggested_partner?.id,
    suggestedPartnerName: dto.suggested_partner?.name ?? EMPTY,
    currencyCode: dto.currency_code,
    estTotalAmount: dto.est_total_amount,
    estTotalAmountLabel: `${dto.currency_code} ${formatNumber(dto.est_total_amount, { decimalScale: 2 })}`,
    isFulfilled: dto.is_fulfilled,
    isPartiallyFulfilled: dto.is_partially_fulfilled,

    // Diturunkan dengan predikat yang sama yang dijaga write gateway, jadi
    // tombolnya tidak pernah ditawarkan untuk transisi yang akan ditolak server.
    isEditable: isPurchaseRequestEditable(status),
    canApprove: canApprovePurchaseRequest(status),
    canVoid: canVoidPurchaseRequest(status) && !dto.is_partially_fulfilled && !dto.is_fulfilled,
    canDelete: canDeletePurchaseRequest(status),
    canConvert: canConvertPurchaseRequest(status, category, dto.is_fulfilled),

    notes: dto.notes ?? EMPTY,
    createdAt: dto.created_at,
  };
}

function toDetailVO(dto: PurchaseRequestDetailDTO): PurchaseRequestDetailVO {
  return {
    ...toVO(dto),
    items: dto.items.map((item) => toItemVO(item, dto.currency_code)),
    createdByName: dto.created_by?.name ?? EMPTY,
    approvedByName: dto.approved_by?.name ?? EMPTY,
    approvedAt: dto.approved_at ?? undefined,
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAt: dto.voided_at ?? undefined,
    voidReason: dto.void_reason ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type PurchaseRequestListParams = ListParams & {
  status?: PurchaseRequestStatus;
  category?: PurchaseRequestCategory;
  priority?: PurchaseRequestPriority;
  date_from?: string;
  date_to?: string;
};

export type PurchaseRequestItemPayload = {
  product_id?: string;
  supply_id?: string;
  weight_unit?: 'GRAM' | 'TROY_OUNCE';
  /** Dalam satuan barisnya — server yang mengubahnya ke gram. */
  quantity: number;
  est_unit_price: number;
  notes?: string;
};

export type PurchaseRequestWritePayload = {
  category: PurchaseRequestCategory;
  date: string;
  required_date?: string;
  department: string;
  priority?: PurchaseRequestPriority;
  suggested_partner_id?: string;
  currency_code?: string;
  notes?: string;
  items: PurchaseRequestItemPayload[];
};

const BASE = '/api/purchase-requests';

export const purchaseRequestService = {
  list: async (params?: PurchaseRequestListParams): Promise<PurchaseRequestListVO> =>
    toPaginatedVO(
      await apiClient.get<PurchaseRequestListDTO>(`${BASE}${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<PurchaseRequestDetailVO> =>
    toDetailVO(
      await apiClient.get<PurchaseRequestDetailDTO>(`${BASE}/${id}`, { cache: 'no-store' }),
    ),

  create: async (payload: PurchaseRequestWritePayload): Promise<PurchaseRequestDetailVO> =>
    toDetailVO(await apiClient.post<PurchaseRequestDetailDTO>(BASE, payload)),

  update: async (
    id: string,
    payload: PurchaseRequestWritePayload,
  ): Promise<PurchaseRequestDetailVO> =>
    toDetailVO(await apiClient.patch<PurchaseRequestDetailDTO>(`${BASE}/${id}`, payload)),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`${BASE}/${id}`);
  },

  approve: async (id: string): Promise<PurchaseRequestDetailVO> =>
    toDetailVO(
      await apiClient.patch<PurchaseRequestDetailDTO>(`${BASE}/${id}/status`, {
        status: 'APPROVED',
      }),
    ),

  void: async (id: string, voidReason: string): Promise<PurchaseRequestDetailVO> =>
    toDetailVO(
      await apiClient.patch<PurchaseRequestDetailDTO>(`${BASE}/${id}/status`, {
        status: 'VOID',
        void_reason: voidReason,
      }),
    ),
};
