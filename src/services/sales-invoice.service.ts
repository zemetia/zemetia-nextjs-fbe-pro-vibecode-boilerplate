import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  isSalesInvoiceEditable,
  isSalesInvoicePostable,
  isSalesInvoiceVoidable,
  SALES_INVOICE_PAYMENT_MODE_LABELS,
  SALES_INVOICE_STATUS_LABELS,
  SALES_PAYMENT_STATUS_LABELS,
} from '@/lib/sales';
import type {
  SalesInvoiceDTO,
  SalesInvoiceDetailDTO,
  SalesInvoiceListDTO,
  SalesInvoicePaymentModeDTO,
  SalesInvoiceStatusDTO,
  SalesOrderTypeDTO,
  SalesPaymentStatusDTO,
} from '@/types/dtos';
import type {
  SalesInvoiceDetailVO,
  SalesInvoiceItemVO,
  SalesInvoiceListVO,
  SalesInvoicePaymentVO,
  SalesInvoiceVO,
} from '@/types/value-objects';

const EMPTY = '—';

function toVO(dto: SalesInvoiceDTO): SalesInvoiceVO {
  const editable = isSalesInvoiceEditable(dto.status);
  return {
    id: dto.id,
    number: dto.number,
    type: dto.type,
    typeLabel: dto.type === 'EXPORT' ? 'Ekspor (Valas)' : 'Lokal (IDR)',
    status: dto.status,
    statusLabel: SALES_INVOICE_STATUS_LABELS[dto.status] ?? dto.status,
    orderId: dto.order.id,
    orderNumber: dto.order.number,
    orderPaymentType: dto.order.payment_type,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    dueDate: dto.due_date ?? undefined,
    dueDateLabel: dto.due_date ? formatDateShort(dto.due_date) : EMPTY,
    currencyCode: dto.currency_code,
    exchangeRate: dto.exchange_rate ?? undefined,
    subtotalAmount: dto.subtotal_amount,
    subtotalAmountLabel: formatCurrency(dto.subtotal_amount),
    dpAmount: dto.dp_amount,
    dpAmountLabel: formatCurrency(dto.dp_amount),
    totalAmount: dto.total_amount,
    totalAmountLabel: formatCurrency(dto.total_amount),
    taxFacility: dto.tax_facility ?? '',
    taxAmountIdr: dto.tax_amount_idr ?? undefined,
    paymentMode: dto.payment_mode,
    paymentModeLabel: SALES_INVOICE_PAYMENT_MODE_LABELS[dto.payment_mode] ?? dto.payment_mode,
    paymentStatus: dto.payment_status,
    paymentStatusLabel: SALES_PAYMENT_STATUS_LABELS[dto.payment_status] ?? dto.payment_status,
    paidAmountIdr: dto.paid_amount_idr,
    remainingBalanceIdr: dto.remaining_balance_idr ?? undefined,
    dheBcaAccount: dto.dhe_bca_account ?? '',
    pebNumber: dto.peb_number ?? '',
    awbNumber: dto.awb_number ?? '',
    notes: dto.notes ?? '',
    isEditable: editable,
    isPostable: isSalesInvoicePostable(dto.status),
    isVoidable: isSalesInvoiceVoidable(dto.status),
    isDeletable: editable,
    createdAt: dto.created_at,
  };
}

function toItemVO(item: SalesInvoiceDetailDTO['items'][number]): SalesInvoiceItemVO {
  return {
    id: item.id,
    orderItemId: item.order_item_id,
    productCode: item.product.code,
    productName: item.product.name,
    weightGram: item.weight_gram,
    weightGramLabel: `${formatNumber(item.weight_gram)} g`,
    amount: item.amount,
    amountLabel: formatCurrency(item.amount),
  };
}

function toPaymentVO(payment: SalesInvoiceDetailDTO['payments'][number]): SalesInvoicePaymentVO {
  return {
    id: payment.id,
    lineNo: payment.line_no,
    voucherNo: payment.voucher_no ?? '',
    voucherType: payment.voucher_type ?? '',
    date: payment.date ?? undefined,
    bank: payment.bank ?? '',
    amount: payment.amount,
    amountLabel: formatCurrency(payment.amount),
    notes: payment.notes ?? '',
    recordedAt: payment.recorded_at,
  };
}

function toDetailVO(dto: SalesInvoiceDetailDTO): SalesInvoiceDetailVO {
  return {
    ...toVO(dto),
    items: dto.items.map(toItemVO),
    payments: dto.payments.map(toPaymentVO),
    directorApprovedByName: dto.director_approved_by?.name ?? EMPTY,
    directorApprovedAtLabel: dto.director_approved_at ? formatDateShort(dto.director_approved_at) : EMPTY,
    journalNumber: dto.journal?.number ?? EMPTY,
    updatedAt: dto.updated_at,
  };
}

export type SalesInvoiceListParams = ListParams & {
  type?: SalesOrderTypeDTO;
  status?: SalesInvoiceStatusDTO;
  payment_status?: SalesPaymentStatusDTO;
  order_id?: string;
  date_from?: string;
  date_to?: string;
};

export interface SalesInvoiceItemPayload {
  order_item_id: string;
  weight_gram: number;
  amount: number;
}

export interface SalesInvoiceWritePayload {
  type: SalesOrderTypeDTO;
  order_id: string;
  date: string;
  due_date?: string | null;
  currency_code: string;
  exchange_rate?: number | null;
  subtotal_amount: number;
  dp_amount?: number;
  total_amount: number;
  tax_facility?: string;
  tax_amount_idr?: number | null;
  payment_mode: SalesInvoicePaymentModeDTO;
  dhe_bca_account?: string;
  peb_number?: string;
  awb_number?: string;
  items: SalesInvoiceItemPayload[];
  notes?: string;
}

export const salesInvoiceService = {
  list: async (params?: SalesInvoiceListParams): Promise<SalesInvoiceListVO> =>
    toPaginatedVO(
      await apiClient.get<SalesInvoiceListDTO>(
        `/api/sales/${params?.type === 'EXPORT' ? 'export-invoices' : 'invoices'}${buildListQuery(params)}`,
        { cache: 'no-store' },
      ),
      toVO,
    ),

  detail: async (id: string, type: SalesOrderTypeDTO): Promise<SalesInvoiceDetailVO> =>
    toDetailVO(
      await apiClient.get<SalesInvoiceDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-invoices' : 'invoices'}/${id}`,
        { cache: 'no-store' },
      ),
    ),

  create: async (payload: SalesInvoiceWritePayload): Promise<SalesInvoiceDetailVO> =>
    toDetailVO(
      await apiClient.post<SalesInvoiceDetailDTO>(
        `/api/sales/${payload.type === 'EXPORT' ? 'export-invoices' : 'invoices'}`,
        payload,
      ),
    ),

  post: async (id: string, type: SalesOrderTypeDTO): Promise<SalesInvoiceDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesInvoiceDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-invoices' : 'invoices'}/${id}/post`,
        {},
      ),
    ),

  void: async (id: string, reason: string, type: SalesOrderTypeDTO): Promise<SalesInvoiceDetailVO> =>
    toDetailVO(
      await apiClient.patch<SalesInvoiceDetailDTO>(
        `/api/sales/${type === 'EXPORT' ? 'export-invoices' : 'invoices'}/${id}/void`,
        { void_reason: reason },
      ),
    ),
};
