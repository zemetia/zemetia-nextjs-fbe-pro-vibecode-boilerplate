import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isSalesOrderEditable,
  isSalesOrderVoidable,
  SALES_PAYMENT_TYPE_LABELS,
  SALES_PAYMENT_STATUS_LABELS,
  SALES_STATUS_LABELS,
  SALES_TYPE_LABELS,
} from '@/lib/sales';
import type {
  SalesOrderDetailDTO,
  SalesOrderDTO,
  SalesOrderListDTO,
  SalesOrderPaymentTypeDTO,
  SalesOrderStatusDTO,
  SalesOrderTypeDTO,
} from '@/types/dtos';
import type {
  SalesOrderDetailVO,
  SalesOrderItemVO,
  SalesOrderListVO,
  SalesOrderVO,
} from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: SalesOrderDTO): SalesOrderVO {
  const editable = isSalesOrderEditable(dto.status);
  return {
    id: dto.id,
    number: dto.number,
    type: dto.type,
    typeLabel: SALES_TYPE_LABELS[dto.type] ?? dto.type,
    paymentType: dto.payment_type,
    paymentTypeLabel: SALES_PAYMENT_TYPE_LABELS[dto.payment_type] ?? dto.payment_type,
    status: dto.status,
    statusLabel: SALES_STATUS_LABELS[dto.status] ?? dto.status,
    partnerId: dto.partner.id,
    partnerCode: dto.partner.code,
    partnerName: dto.partner.name,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    dueDate: dto.due_date ?? undefined,
    dueDateLabel: dto.due_date ? formatDateShort(dto.due_date) : EMPTY,
    customerPoNumber: dto.customer_po_number ?? '',
    currencyCode: dto.currency_code,
    exchangeRate: dto.exchange_rate ?? undefined,
    goodsAmount: dto.goods_amount,
    goodsAmountLabel: formatCurrency(dto.goods_amount),
    paymentStatus: dto.payment_status,
    paymentStatusLabel: SALES_PAYMENT_STATUS_LABELS[dto.payment_status] ?? dto.payment_status,
    paidAmountIdr: dto.paid_amount_idr,
    remainingBalanceIdr: dto.remaining_balance_idr ?? undefined,
    notes: dto.notes ?? '',
    isEditable: editable,
    isVoidable: isSalesOrderVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

function toItemVO(item: SalesOrderDetailDTO['items'][number]): SalesOrderItemVO {
  return {
    id: item.id,
    lineNo: item.line_no,
    productId: item.product.id,
    productCode: item.product.code,
    productName: item.product.name,
    weightUnit: item.weight_unit,
    weightGram: item.weight_gram,
    weightGramLabel: `${formatNumber(item.weight_gram)} g`,
    purityPercent: item.purity_percent,
    fineWeightGram: item.fine_weight_gram,
    priceBasis: item.price_basis,
    pricePerUnit: item.price_per_unit,
    pricePerUnitLabel: formatCurrency(item.price_per_unit),
    amount: item.amount,
    amountLabel: formatCurrency(item.amount),
    notes: item.notes ?? '',
  };
}

function toDetailVO(dto: SalesOrderDetailDTO): SalesOrderDetailVO {
  return {
    ...toVO(dto),
    items: dto.items.map(toItemVO),
    confirmedByName: dto.confirmed_by?.name ?? EMPTY,
    confirmedAtLabel: dto.confirmed_at ? formatDateShort(dto.confirmed_at) : EMPTY,
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAtLabel: dto.voided_at ? formatDateShort(dto.voided_at) : EMPTY,
    voidReason: dto.void_reason ?? EMPTY,
    directorApprovedByName: dto.director_approved_by?.name ?? EMPTY,
    directorApprovedAtLabel: dto.director_approved_at ? formatDateShort(dto.director_approved_at) : EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type SalesOrderListParams = ListParams & {
  type?: SalesOrderTypeDTO;
  payment_type?: SalesOrderPaymentTypeDTO;
  status?: SalesOrderStatusDTO;
  partner_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface SalesOrderItemPayload {
  product_id: string;
  weight_unit: 'GRAM' | 'TROY_OUNCE';
  weight_gram: number;
  purity_percent: number;
  price_per_unit: number;
  notes?: string;
}

export interface SalesOrderWritePayload {
  type: SalesOrderTypeDTO;
  payment_type: SalesOrderPaymentTypeDTO;
  partner_id: string;
  date: string;
  due_date?: string | null;
  customer_po_number?: string;
  currency_code: string;
  exchange_rate?: number | null;
  items: SalesOrderItemPayload[];
  notes?: string;
}

export const salesOrderService = {
  list: async (params?: SalesOrderListParams): Promise<SalesOrderListVO> =>
    toPaginatedVO(
      await apiClient.get<SalesOrderListDTO>(`/api/sales/orders${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  listLocal: async (params?: SalesOrderListParams): Promise<SalesOrderListVO> =>
    toPaginatedVO(
      await apiClient.get<SalesOrderListDTO>(`/api/sales/local${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<SalesOrderDetailVO> =>
    toDetailVO(
      await apiClient.get<SalesOrderDetailDTO>(`/api/sales/orders/${id}`, { cache: 'no-store' }),
    ),

  detailLocal: async (id: string): Promise<SalesOrderDetailVO> =>
    toDetailVO(
      await apiClient.get<SalesOrderDetailDTO>(`/api/sales/local/${id}`, { cache: 'no-store' }),
    ),

  create: async (payload: SalesOrderWritePayload): Promise<SalesOrderDetailVO> =>
    toDetailVO(
      await apiClient.post<SalesOrderDetailDTO>(
        payload.type === 'EXPORT' ? '/api/sales/orders' : '/api/sales/local',
        payload,
      ),
    ),

  confirm: async (id: string, type: SalesOrderTypeDTO): Promise<SalesOrderDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesOrderDetailDTO>(
        type === 'EXPORT' ? `/api/sales/orders/${id}/approve` : `/api/sales/local/${id}/status`,
        type === 'EXPORT' ? {} : { status: 'CONFIRMED' },
      ),
    ),

  void: async (id: string, reason: string, type: SalesOrderTypeDTO): Promise<SalesOrderDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesOrderDetailDTO>(
        type === 'EXPORT' ? `/api/sales/orders/${id}/void` : `/api/sales/local/${id}/status`,
        type === 'EXPORT' ? { void_reason: reason } : { status: 'VOID', void_reason: reason },
      ),
    ),

  remove: async (id: string, type: SalesOrderTypeDTO): Promise<void> => {
    await apiClient.delete<void>(`/api/sales/${type === 'EXPORT' ? 'orders' : 'local'}/${id}`);
  },
};
