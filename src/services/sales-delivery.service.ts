import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isSalesDeliveryEditable,
  isSalesDeliveryVoidable,
  SALES_DELIVERY_METHOD_LABELS,
  SALES_DELIVERY_STATUS_LABELS,
} from '@/lib/sales';
import type {
  SalesDeliveryDTO,
  SalesDeliveryDetailDTO,
  SalesDeliveryListDTO,
  SalesDeliveryMethodDTO,
  SalesDeliveryStatusDTO,
  SalesOrderTypeDTO,
} from '@/types/dtos';
import type {
  SalesDeliveryChargeVO,
  SalesDeliveryDetailVO,
  SalesDeliveryLineVO,
  SalesDeliveryListVO,
  SalesDeliveryVO,
} from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: SalesDeliveryDTO): SalesDeliveryVO {
  const editable = isSalesDeliveryEditable(dto.status);
  return {
    id: dto.id,
    number: dto.number,
    status: dto.status,
    statusLabel: SALES_DELIVERY_STATUS_LABELS[dto.status] ?? dto.status,
    orderId: dto.order.id,
    orderNumber: dto.order.number,
    orderPaymentType: dto.order.payment_type,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    recipientName: dto.recipient_name ?? '',
    deliveryMethod: dto.delivery_method,
    deliveryMethodLabel: SALES_DELIVERY_METHOD_LABELS[dto.delivery_method] ?? dto.delivery_method,
    courierName: dto.courier_name ?? '',
    carrierName: dto.carrier_name ?? '',
    awbNumber: dto.awb_number ?? '',
    pebNumber: dto.peb_number ?? '',
    movementId: dto.movement_id ?? '',
    totalWeightGram: dto.total_weight_gram,
    notes: dto.notes ?? '',
    isEditable: editable,
    isVoidable: isSalesDeliveryVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

function toLineVO(line: SalesDeliveryDetailDTO['lines'][number]): SalesDeliveryLineVO {
  return {
    id: line.id,
    orderItemId: line.order_item_id,
    productCode: line.product.code,
    productName: line.product.name,
    lotId: line.lot.id,
    lotCode: line.lot.code,
    lotSerialNumber: line.lot.serial_number ?? '',
    locationCode: line.location.code,
    locationName: line.location.name,
    pieceCount: line.piece_count,
    grossWeightGram: line.gross_weight_gram,
    grossWeightGramLabel: `${formatNumber(line.gross_weight_gram)} g`,
    purityPercent: line.purity_percent,
    fineWeightGram: line.fine_weight_gram,
    note: line.note ?? '',
  };
}

function toChargeVO(charge: SalesDeliveryDetailDTO['charges'][number]): SalesDeliveryChargeVO {
  return {
    id: charge.id,
    lineNo: charge.line_no,
    name: charge.name,
    amountIdr: charge.amount_idr,
    amountIdrLabel: formatCurrency(charge.amount_idr),
  };
}

function toDetailVO(dto: SalesDeliveryDetailDTO): SalesDeliveryDetailVO {
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

export type SalesDeliveryListParams = ListParams & {
  type?: SalesOrderTypeDTO;
  status?: SalesDeliveryStatusDTO;
  order_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface SalesDeliveryLinePayload {
  order_item_id: string;
  lot_id: string;
  location_id: string;
  piece_count?: number;
  gross_weight_gram: number;
  purity_percent: number;
  note?: string;
}

export interface SalesDeliveryChargePayload {
  name: string;
  amount_idr: number;
}

export interface SalesDeliveryWritePayload {
  type: SalesOrderTypeDTO;
  order_id: string;
  date: string;
  recipient_name?: string;
  delivery_method: SalesDeliveryMethodDTO;
  courier_name?: string;
  carrier_name?: string;
  awb_number?: string;
  peb_number?: string;
  seal_number?: string;
  box_count?: number;
  gold_certificate_no?: string;
  purity_certificate_no?: string;
  lines: SalesDeliveryLinePayload[];
  charges: SalesDeliveryChargePayload[];
  notes?: string;
}

export const salesDeliveryService = {
  list: async (params?: SalesDeliveryListParams): Promise<SalesDeliveryListVO> =>
    toPaginatedVO(
      await apiClient.get<SalesDeliveryListDTO>(
        `/api/sales/${params?.type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}${buildListQuery(params)}`,
        { cache: 'no-store' },
      ),
      toVO,
    ),

  detail: async (id: string, type: SalesOrderTypeDTO): Promise<SalesDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.get<SalesDeliveryDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}/${id}`,
        { cache: 'no-store' },
      ),
    ),

  create: async (payload: SalesDeliveryWritePayload): Promise<SalesDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.post<SalesDeliveryDetailDTO>(
        `/api/sales/${payload.type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}`,
        payload,
      ),
    ),

  confirm: async (id: string, type: SalesOrderTypeDTO): Promise<SalesDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesDeliveryDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}/${id}/confirm`,
        {},
      ),
    ),

  void: async (id: string, reason: string, type: SalesOrderTypeDTO): Promise<SalesDeliveryDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesDeliveryDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}/${id}/void`,
        { void_reason: reason },
      ),
    ),

  remove: async (id: string, type: SalesOrderTypeDTO): Promise<void> => {
    await apiClient.delete<void>(
      `/api/sales/${type === 'EXPORT' ? 'export-deliveries' : 'deliveries'}/${id}`,
    );
  },
};
