import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isMetalPurchaseDeliveryEditable,
  isMetalPurchaseDeliveryVoidable,
  METAL_PURCHASE_DELIVERY_STATUS_LABELS,
  METAL_PURCHASE_TYPE_LABELS,
} from '@/lib/metal-purchase';
import type {
  MetalPurchaseDeliveryDetailDTO,
  MetalPurchaseDeliveryDTO,
  MetalPurchaseDeliveryListDTO,
  MetalPurchaseDeliveryStatusDTO,
} from '@/types/dtos';
import type {
  MetalPurchaseDeliveryChargeVO,
  MetalPurchaseDeliveryDetailVO,
  MetalPurchaseDeliveryLineVO,
  MetalPurchaseDeliveryListVO,
  MetalPurchaseDeliveryVO,
} from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: MetalPurchaseDeliveryDTO): MetalPurchaseDeliveryVO {
  const editable = isMetalPurchaseDeliveryEditable(dto.status);
  return {
    id: dto.id,
    number: dto.number,
    status: dto.status,
    statusLabel: METAL_PURCHASE_DELIVERY_STATUS_LABELS[dto.status] ?? dto.status,
    purchaseId: dto.purchase.id,
    purchaseNumber: dto.purchase.number,
    purchasePaymentType: dto.purchase.payment_type,
    purchaseType: dto.purchase.type,
    purchaseTypeLabel: METAL_PURCHASE_TYPE_LABELS[dto.purchase.type] ?? dto.purchase.type,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    courierPartnerName: dto.courier_partner?.name ?? '',
    trackingNumber: dto.tracking_number ?? '',
    receivedByName: dto.received_by_name ?? '',
    corNumber: dto.cor_number ?? '',
    supplierDoNumber: dto.supplier_do_number ?? '',
    pibNo: dto.pib_no ?? '',
    sppbNo: dto.sppb_no ?? '',
    mawbNo: dto.mawb_no ?? '',
    barSerialNumbers: dto.bar_serial_numbers ?? '',
    assayCertificateNo: dto.assay_certificate_no ?? '',
    safeBoxSlot: dto.safe_box_slot ?? '',
    securitySealNo: dto.security_seal_no ?? '',
    documentWeightGram: dto.document_weight_gram,
    receivedWeightGram: dto.received_weight_gram,
    weightDiscrepancyGram: dto.weight_discrepancy_gram,
    weightDiscrepancyLabel:
      dto.weight_discrepancy_gram === null
        ? EMPTY
        : dto.weight_discrepancy_gram === 0
          ? 'Pas / klop (0 g)'
          : `${dto.weight_discrepancy_gram > 0 ? 'Lebih' : 'Kurang'} ${formatNumber(Math.abs(dto.weight_discrepancy_gram))} g`,
    notes: dto.notes ?? '',
    isEditable: editable,
    isVoidable: isMetalPurchaseDeliveryVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

function toLineVO(line: MetalPurchaseDeliveryDetailDTO['lines'][number]): MetalPurchaseDeliveryLineVO {
  return {
    id: line.id,
    purchaseItemId: line.purchase_item_id,
    productCode: line.product.code,
    productName: line.product.name,
    weightGram: line.weight_gram,
    weightGramLabel: `${formatNumber(line.weight_gram)} g`,
    purityPercent: line.purity_percent,
    fineWeightGram: line.fine_weight_gram,
    note: line.note ?? '',
  };
}

function toChargeVO(
  charge: MetalPurchaseDeliveryDetailDTO['charges'][number],
): MetalPurchaseDeliveryChargeVO {
  return {
    id: charge.id,
    lineNo: charge.line_no,
    name: charge.name,
    amountIdr: charge.amount_idr,
    amountIdrLabel: formatCurrency(charge.amount_idr),
  };
}

function toDetailVO(dto: MetalPurchaseDeliveryDetailDTO): MetalPurchaseDeliveryDetailVO {
  return {
    ...toVO(dto),
    lines: dto.lines.map(toLineVO),
    charges: dto.charges.map(toChargeVO),
    confirmedByName: dto.confirmed_by?.name ?? EMPTY,
    confirmedAtLabel: dto.confirmed_at ? formatDateShort(dto.confirmed_at) : EMPTY,
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAtLabel: dto.voided_at ? formatDateShort(dto.voided_at) : EMPTY,
    voidReason: dto.void_reason ?? EMPTY,
    journalNumber: dto.journal?.number ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type MetalPurchaseDeliveryListParams = ListParams & {
  purchase_id?: string;
  status?: MetalPurchaseDeliveryStatusDTO;
  date_from?: string;
  date_to?: string;
};

export interface MetalPurchaseDeliveryLinePayload {
  purchase_item_id: string;
  weight_gram: number;
  purity_percent: number;
  note?: string;
}

export interface MetalPurchaseDeliveryChargePayload {
  name: string;
  amount_idr: number;
}

export interface MetalPurchaseDeliveryWritePayload {
  purchase_id: string;
  /** Override manual — kosong berarti digenerate server (`TTB-YYYYMM-XXXX`). */
  number?: string;
  date: string;
  courier_partner_id?: string;
  tracking_number?: string;
  received_by_name?: string;
  cor_number?: string;
  supplier_do_number?: string;
  pib_no?: string;
  sppb_no?: string;
  mawb_no?: string;
  bar_serial_numbers?: string;
  assay_certificate_no?: string;
  safe_box_slot?: string;
  security_seal_no?: string;
  document_weight_gram?: number;
  lines: MetalPurchaseDeliveryLinePayload[];
  charges: MetalPurchaseDeliveryChargePayload[];
  notes?: string;
}

export const metalPurchaseDeliveryService = {
  list: async (params?: MetalPurchaseDeliveryListParams): Promise<MetalPurchaseDeliveryListVO> =>
    toPaginatedVO(
      await apiClient.get<MetalPurchaseDeliveryListDTO>(
        `/api/metal-purchase-deliveries${buildListQuery(params)}`,
        { cache: 'no-store' },
      ),
      toVO,
    ),

  detail: async (id: string): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.get<MetalPurchaseDeliveryDetailDTO>(`/api/metal-purchase-deliveries/${id}`, {
        cache: 'no-store',
      }),
    ),

  create: async (payload: MetalPurchaseDeliveryWritePayload): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.post<MetalPurchaseDeliveryDetailDTO>('/api/metal-purchase-deliveries', payload),
    ),

  update: async (
    id: string,
    payload: MetalPurchaseDeliveryWritePayload,
  ): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDeliveryDetailDTO>(
        `/api/metal-purchase-deliveries/${id}`,
        payload,
      ),
    ),

  ship: async (id: string): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDeliveryDetailDTO>(
        `/api/metal-purchase-deliveries/${id}/status`,
        { status: 'IN_TRANSIT' },
      ),
    ),

  confirm: async (id: string): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDeliveryDetailDTO>(
        `/api/metal-purchase-deliveries/${id}/status`,
        { status: 'CONFIRMED' },
      ),
    ),

  void: async (id: string, reason: string): Promise<MetalPurchaseDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDeliveryDetailDTO>(
        `/api/metal-purchase-deliveries/${id}/status`,
        { status: 'VOID', void_reason: reason },
      ),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/metal-purchase-deliveries/${id}`);
  },
};
