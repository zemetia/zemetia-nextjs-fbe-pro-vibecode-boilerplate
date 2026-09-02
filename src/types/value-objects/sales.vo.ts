import type { PaginatedVO } from './pagination.vo';
import type { WeightUnit } from './purchase-request.vo';

export type { WeightUnit };

// ── Sales Order (SO) ─────────────────────────────────────────────────────────

export type SalesOrderType = 'EXPORT' | 'LOCAL';
export type SalesOrderPaymentType = 'PO' | 'DP';
export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type SalesPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface SalesOrderItemVO {
  id: string;
  lineNo: number;
  productId: string;
  productCode: string;
  productName: string;
  weightUnit: WeightUnit;
  weightGram: number;
  weightGramLabel: string;
  purityPercent: number;
  fineWeightGram: number;
  priceBasis: 'GROSS' | 'FINE';
  pricePerUnit: number;
  pricePerUnitLabel: string;
  amount: number;
  amountLabel: string;
  notes: string;
}

export interface SalesOrderVO {
  id: string;
  number: string;
  type: SalesOrderType;
  typeLabel: string;
  paymentType: SalesOrderPaymentType;
  paymentTypeLabel: string;
  status: SalesOrderStatus;
  statusLabel: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  date: string;
  dateLabel: string;
  dueDate: string | undefined;
  dueDateLabel: string;
  customerPoNumber: string;
  currencyCode: string;
  exchangeRate: number | undefined;
  goodsAmount: number;
  goodsAmountLabel: string;
  paymentStatus: SalesPaymentStatus;
  paymentStatusLabel: string;
  paidAmountIdr: number;
  remainingBalanceIdr: number | undefined;
  notes: string;
  isEditable: boolean;
  isVoidable: boolean;
  isDeletable: boolean;
  createdAt: string;
}

export interface SalesOrderDetailVO extends SalesOrderVO {
  items: SalesOrderItemVO[];
  confirmedByName: string;
  confirmedAtLabel: string;
  voidedByName: string;
  voidedAtLabel: string;
  voidReason: string;
  directorApprovedByName: string;
  directorApprovedAtLabel: string;
  updatedAt: string;
}

export type SalesOrderListVO = PaginatedVO<SalesOrderVO>;

// ── Surat Jalan (Sales Delivery) ─────────────────────────────────────────────

export type SalesDeliveryStatus = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type SalesDeliveryMethod = 'COUNTER' | 'KURIR_INTERNAL' | 'EXPEDITION';

export interface SalesDeliveryLineVO {
  id: string;
  orderItemId: string;
  productCode: string;
  productName: string;
  lotId: string;
  lotCode: string;
  lotSerialNumber: string;
  locationCode: string;
  locationName: string;
  pieceCount: number;
  grossWeightGram: number;
  grossWeightGramLabel: string;
  purityPercent: number;
  fineWeightGram: number;
  note: string;
}

export interface SalesDeliveryChargeVO {
  id: string;
  lineNo: number;
  name: string;
  amountIdr: number;
  amountIdrLabel: string;
}

export interface SalesDeliveryVO {
  id: string;
  number: string;
  status: SalesDeliveryStatus;
  statusLabel: string;
  orderId: string;
  orderNumber: string;
  orderPaymentType: SalesOrderPaymentType;
  date: string;
  dateLabel: string;
  recipientName: string;
  deliveryMethod: SalesDeliveryMethod;
  deliveryMethodLabel: string;
  courierName: string;
  carrierName: string;
  awbNumber: string;
  pebNumber: string;
  movementId: string;
  /** Σ berat kotor seluruh baris — cukup untuk daftar ringkas. */
  totalWeightGram: number;
  notes: string;
  isEditable: boolean;
  isVoidable: boolean;
  isDeletable: boolean;
  createdAt: string;
}

export interface SalesDeliveryDetailVO extends SalesDeliveryVO {
  lines: SalesDeliveryLineVO[];
  charges: SalesDeliveryChargeVO[];
  confirmedByName: string;
  confirmedAtLabel: string;
  voidedByName: string;
  voidedAtLabel: string;
  voidReason: string;
  journalNumber: string;
  updatedAt: string;
}

export type SalesDeliveryListVO = PaginatedVO<SalesDeliveryVO>;

// ── Faktur / Nota (Sales Invoice) ────────────────────────────────────────────

export type SalesInvoiceStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type SalesInvoicePaymentMode = 'CASH' | 'CREDIT' | 'DP';

export interface SalesInvoiceItemVO {
  id: string;
  orderItemId: string;
  productCode: string;
  productName: string;
  weightGram: number;
  weightGramLabel: string;
  amount: number;
  amountLabel: string;
}

export interface SalesInvoicePaymentVO {
  id: string;
  lineNo: number;
  voucherNo: string;
  voucherType: string;
  date: string | undefined;
  bank: string;
  amount: number;
  amountLabel: string;
  notes: string;
  recordedAt: string;
}

export interface SalesInvoiceVO {
  id: string;
  number: string;
  type: SalesOrderType;
  typeLabel: string;
  status: SalesInvoiceStatus;
  statusLabel: string;
  orderId: string;
  orderNumber: string;
  orderPaymentType: SalesOrderPaymentType;
  date: string;
  dateLabel: string;
  dueDate: string | undefined;
  dueDateLabel: string;
  currencyCode: string;
  exchangeRate: number | undefined;
  subtotalAmount: number;
  subtotalAmountLabel: string;
  dpAmount: number;
  dpAmountLabel: string;
  totalAmount: number;
  totalAmountLabel: string;
  taxFacility: string;
  taxAmountIdr: number | undefined;
  paymentMode: SalesInvoicePaymentMode;
  paymentModeLabel: string;
  paymentStatus: SalesPaymentStatus;
  paymentStatusLabel: string;
  paidAmountIdr: number;
  remainingBalanceIdr: number | undefined;
  dheBcaAccount: string;
  pebNumber: string;
  awbNumber: string;
  notes: string;
  isEditable: boolean;
  isPostable: boolean;
  isVoidable: boolean;
  isDeletable: boolean;
  createdAt: string;
}

export interface SalesInvoiceDetailVO extends SalesInvoiceVO {
  items: SalesInvoiceItemVO[];
  payments: SalesInvoicePaymentVO[];
  directorApprovedByName: string;
  directorApprovedAtLabel: string;
  journalNumber: string;
  updatedAt: string;
}

export type SalesInvoiceListVO = PaginatedVO<SalesInvoiceVO>;
