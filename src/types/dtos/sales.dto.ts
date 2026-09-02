import type { PriceBasisDTO } from './product.dto';
import type { WeightUnitDTO } from './purchase-request.dto';

export type { PriceBasisDTO, WeightUnitDTO };

// ── Sales Order (SO) ─────────────────────────────────────────────────────────

export type SalesOrderTypeDTO = 'EXPORT' | 'LOCAL';
export type SalesOrderPaymentTypeDTO = 'PO' | 'DP';
export type SalesOrderStatusDTO = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type SalesPaymentStatusDTO = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface SalesPartnerRefDTO {
  id: string;
  code: string;
  name: string;
}

export interface SalesProductRefDTO {
  id: string;
  code: string;
  name: string;
}

export interface SalesOrderItemDTO {
  id: string;
  line_no: number;
  product: SalesProductRefDTO;
  weight_unit: WeightUnitDTO;
  weight_gram: number;
  purity_percent: number;
  fine_weight_gram: number;
  price_basis: PriceBasisDTO;
  price_per_unit: number;
  amount: number;
  notes: string | null;
}

export interface SalesOrderDTO {
  id: string;
  number: string;
  type: SalesOrderTypeDTO;
  payment_type: SalesOrderPaymentTypeDTO;
  status: SalesOrderStatusDTO;
  partner: SalesPartnerRefDTO;
  date: string;
  due_date: string | null;
  customer_po_number: string | null;
  currency_code: string;
  exchange_rate: number | null;
  goods_amount: number;
  payment_status: SalesPaymentStatusDTO;
  paid_amount_idr: number;
  remaining_balance_idr: number | null;
  /** Baris pertama — cukup untuk daftar ringkas tanpa memuat seluruh items. */
  first_item: {
    product: SalesProductRefDTO;
    weight_gram: number;
    purity_percent: number;
    price_per_unit: number;
    amount: number;
  } | null;
  notes: string | null;
  created_at: string;
}

export interface SalesOrderDetailDTO extends SalesOrderDTO {
  items: SalesOrderItemDTO[];
  confirmed_by: { id: string; name: string | null } | null;
  confirmed_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  director_approved_by: { id: string; name: string | null } | null;
  director_approved_at: string | null;
  updated_at: string;
}

export type SalesOrderListDTO = import('./pagination.dto').PaginatedDTO<SalesOrderDTO>;

// ── Surat Jalan (Sales Delivery) ─────────────────────────────────────────────

export type SalesDeliveryStatusDTO = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type SalesDeliveryMethodDTO = 'COUNTER' | 'KURIR_INTERNAL' | 'EXPEDITION';

export interface SalesDeliveryLineDTO {
  id: string;
  order_item_id: string;
  product: SalesProductRefDTO;
  lot: { id: string; code: string; serial_number: string | null; certificate_number: string | null };
  location: { id: string; code: string; name: string };
  piece_count: number;
  gross_weight_gram: number;
  purity_percent: number;
  fine_weight_gram: number;
  note: string | null;
}

export interface SalesDeliveryChargeDTO {
  id: string;
  line_no: number;
  name: string;
  amount_idr: number;
}

export interface SalesDeliveryDTO {
  id: string;
  number: string;
  status: SalesDeliveryStatusDTO;
  order: { id: string; number: string; payment_type: SalesOrderPaymentTypeDTO };
  date: string;
  recipient_name: string | null;
  delivery_method: SalesDeliveryMethodDTO;
  courier_name: string | null;
  carrier_name: string | null;
  awb_number: string | null;
  peb_number: string | null;
  movement_id: string | null;
  /** Σ berat kotor seluruh baris — cukup untuk daftar ringkas. */
  total_weight_gram: number;
  notes: string | null;
  created_at: string;
}

export interface SalesDeliveryDetailDTO extends SalesDeliveryDTO {
  lines: SalesDeliveryLineDTO[];
  charges: SalesDeliveryChargeDTO[];
  confirmed_by: { id: string; name: string | null } | null;
  confirmed_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  journal: { id: string; number: string; status: string } | null;
  updated_at: string;
}

export type SalesDeliveryListDTO = import('./pagination.dto').PaginatedDTO<SalesDeliveryDTO>;

// ── Faktur / Nota (Sales Invoice) ────────────────────────────────────────────

export type SalesInvoiceStatusDTO = 'DRAFT' | 'POSTED' | 'VOID';
export type SalesInvoicePaymentModeDTO = 'CASH' | 'CREDIT' | 'DP';

export interface SalesInvoiceItemDTO {
  id: string;
  order_item_id: string;
  product: SalesProductRefDTO;
  weight_gram: number;
  amount: number;
}

export interface SalesInvoicePaymentDTO {
  id: string;
  line_no: number;
  voucher_no: string | null;
  voucher_type: string | null;
  date: string | null;
  bank: string | null;
  amount: number;
  notes: string | null;
  recorded_at: string;
}

export interface SalesInvoiceDTO {
  id: string;
  number: string;
  type: SalesOrderTypeDTO;
  status: SalesInvoiceStatusDTO;
  order: { id: string; number: string; payment_type: SalesOrderPaymentTypeDTO };
  date: string;
  due_date: string | null;
  currency_code: string;
  exchange_rate: number | null;
  subtotal_amount: number;
  dp_amount: number;
  total_amount: number;
  tax_facility: string | null;
  tax_amount_idr: number | null;
  payment_mode: SalesInvoicePaymentModeDTO;
  payment_status: SalesPaymentStatusDTO;
  paid_amount_idr: number;
  remaining_balance_idr: number | null;
  dhe_bca_account: string | null;
  peb_number: string | null;
  awb_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesInvoiceDetailDTO extends SalesInvoiceDTO {
  items: SalesInvoiceItemDTO[];
  payments: SalesInvoicePaymentDTO[];
  director_approved_by: { id: string; name: string | null } | null;
  director_approved_at: string | null;
  created_by: { id: string; name: string | null } | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  journal: { id: string; number: string; status: string } | null;
  updated_at: string;
}

export type SalesInvoiceListDTO = import('./pagination.dto').PaginatedDTO<SalesInvoiceDTO>;
