import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isMetalPurchaseEditable,
  isMetalPurchaseVoidable,
  METAL_PURCHASE_PAYMENT_TYPE_LABELS,
  METAL_PURCHASE_STATUS_LABELS,
  METAL_PURCHASE_TYPE_LABELS,
} from '@/lib/metal-purchase';
import type {
  MetalPurchaseDetailDTO,
  MetalPurchaseDTO,
  MetalPurchaseListDTO,
  MetalPurchasePaymentTypeDTO,
  MetalPurchaseStatusDTO,
  MetalPurchaseTypeDTO,
} from '@/types/dtos';
import type {
  MetalPurchaseChargeVO,
  MetalPurchaseDetailVO,
  MetalPurchaseItemVO,
  MetalPurchaseListVO,
  MetalPurchaseVO,
} from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: MetalPurchaseDTO): MetalPurchaseVO {
  const editable = isMetalPurchaseEditable(dto.status);
  return {
    id: dto.id,
    number: dto.number,
    type: dto.type,
    typeLabel: METAL_PURCHASE_TYPE_LABELS[dto.type] ?? dto.type,
    paymentType: dto.payment_type,
    paymentTypeLabel: METAL_PURCHASE_PAYMENT_TYPE_LABELS[dto.payment_type] ?? dto.payment_type,
    status: dto.status,
    statusLabel: METAL_PURCHASE_STATUS_LABELS[dto.status] ?? dto.status,
    partnerId: dto.partner.id,
    partnerCode: dto.partner.code,
    partnerName: dto.partner.name,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    dueDate: dto.due_date ?? undefined,
    dueDateLabel: dto.due_date ? formatDateShort(dto.due_date) : EMPTY,
    supplierInvoiceNumber: dto.supplier_invoice_number ?? '',
    currencyCode: dto.currency_code,
    exchangeRate: dto.exchange_rate ?? undefined,
    pibNumber: dto.pib_number ?? '',
    sppbNumber: dto.sppb_number ?? '',
    mawbNumber: dto.mawb_number ?? '',
    courierName: dto.courier_name ?? '',
    courierMandateNumber: dto.courier_mandate_number ?? '',
    pickupLocation: dto.pickup_location ?? '',
    goodsAmount: dto.goods_amount,
    goodsAmountLabel: formatCurrency(dto.goods_amount),
    purchaseRequestId: dto.purchase_request_id,
    purchaseRequestNumber: dto.purchase_request_number ?? '',
    notes: dto.notes ?? '',
    isEditable: editable,
    isVoidable: isMetalPurchaseVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

function toItemVO(item: MetalPurchaseDetailDTO['items'][number]): MetalPurchaseItemVO {
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
    pricePerUnit: item.price_per_unit,
    pricePerUnitLabel: formatCurrency(item.price_per_unit),
    amount: item.amount,
    amountLabel: formatCurrency(item.amount),
    notes: item.notes ?? '',
  };
}

function toChargeVO(charge: MetalPurchaseDetailDTO['charges'][number]): MetalPurchaseChargeVO {
  return {
    id: charge.id,
    lineNo: charge.line_no,
    name: charge.name,
    amountIdr: charge.amount_idr,
    amountIdrLabel: formatCurrency(charge.amount_idr),
  };
}

function toDetailVO(dto: MetalPurchaseDetailDTO): MetalPurchaseDetailVO {
  return {
    ...toVO(dto),
    items: dto.items.map(toItemVO),
    charges: dto.charges.map(toChargeVO),
    confirmedByName: dto.confirmed_by?.name ?? EMPTY,
    confirmedAtLabel: dto.confirmed_at ? formatDateShort(dto.confirmed_at) : EMPTY,
    voidedByName: dto.voided_by?.name ?? EMPTY,
    voidedAtLabel: dto.voided_at ? formatDateShort(dto.voided_at) : EMPTY,
    voidReason: dto.void_reason ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type MetalPurchaseListParams = ListParams & {
  type?: MetalPurchaseTypeDTO;
  payment_type?: MetalPurchasePaymentTypeDTO;
  status?: MetalPurchaseStatusDTO;
  partner_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface MetalPurchaseItemPayload {
  product_id: string;
  /** Baris PR asal, bila dokumen ini konversi dari Purchase Request. */
  purchase_request_item_id?: string;
  weight_unit: 'GRAM' | 'TROY_OUNCE';
  weight_gram: number;
  purity_percent: number;
  price_per_unit: number;
  notes?: string;
}

export interface MetalPurchaseChargePayload {
  name: string;
  amount_idr: number;
}

export interface MetalPurchaseWritePayload {
  type: MetalPurchaseTypeDTO;
  payment_type: MetalPurchasePaymentTypeDTO;
  partner_id: string;
  date: string;
  due_date?: string | null;
  supplier_invoice_number?: string;
  currency_code: string;
  exchange_rate?: number | null;
  /** Dokumen kepabeanan & kargo — khusus impor. */
  pib_number?: string | null;
  sppb_number?: string | null;
  mawb_number?: string | null;
  courier_name?: string | null;
  courier_mandate_number?: string | null;
  /** Lokasi fisik pengambilan barang — khusus rail lokal. */
  pickup_location?: string | null;
  /** Purchase Request asal, bila dokumen ini konversi dari PR. */
  purchase_request_id?: string;
  items: MetalPurchaseItemPayload[];
  charges: MetalPurchaseChargePayload[];
  notes?: string;
}

export const metalPurchaseService = {
  list: async (params?: MetalPurchaseListParams): Promise<MetalPurchaseListVO> =>
    toPaginatedVO(
      await apiClient.get<MetalPurchaseListDTO>(`/api/metal-purchases${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<MetalPurchaseDetailVO> =>
    toDetailVO(
      await apiClient.get<MetalPurchaseDetailDTO>(`/api/metal-purchases/${id}`, { cache: 'no-store' }),
    ),

  create: async (payload: MetalPurchaseWritePayload): Promise<MetalPurchaseDetailVO> =>
    toDetailVO(await apiClient.post<MetalPurchaseDetailDTO>('/api/metal-purchases', payload)),

  update: async (id: string, payload: MetalPurchaseWritePayload): Promise<MetalPurchaseDetailVO> =>
    toDetailVO(await apiClient.patch<MetalPurchaseDetailDTO>(`/api/metal-purchases/${id}`, payload)),

  confirm: async (id: string): Promise<MetalPurchaseDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDetailDTO>(`/api/metal-purchases/${id}/status`, {
        status: 'CONFIRMED',
      }),
    ),

  void: async (id: string, reason: string): Promise<MetalPurchaseDetailVO> =>
    toDetailVO(
      await apiClient.patch<MetalPurchaseDetailDTO>(`/api/metal-purchases/${id}/status`, {
        status: 'VOID',
        void_reason: reason,
      }),
    ),

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/api/metal-purchases/${id}`);
  },
};
