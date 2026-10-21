import type { PaginatedVO } from './pagination.vo';
import type { WeightUnit } from './purchase-request.vo';

export type { WeightUnit };

export type MetalPurchaseType = 'LOCAL' | 'IMPORT' | 'SCRAP_LOCAL';
export type MetalPurchasePaymentType = 'PO' | 'DP';
export type MetalPurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type MetalPurchaseDeliveryStatus = 'DRAFT' | 'IN_TRANSIT' | 'CONFIRMED' | 'VOID';

export interface MetalPurchaseItemVO {
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
  pricePerUnit: number;
  pricePerUnitLabel: string;
  amount: number;
  amountLabel: string;
  notes: string;
}

export interface MetalPurchaseChargeVO {
  id: string;
  lineNo: number;
  name: string;
  amountIdr: number;
  amountIdrLabel: string;
}

export interface MetalPurchaseVO {
  id: string;
  number: string;
  type: MetalPurchaseType;
  typeLabel: string;
  paymentType: MetalPurchasePaymentType;
  paymentTypeLabel: string;
  status: MetalPurchaseStatus;
  statusLabel: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  date: string;
  dateLabel: string;
  dueDate: string | undefined;
  dueDateLabel: string;
  supplierInvoiceNumber: string;
  currencyCode: string;
  exchangeRate: number | undefined;
  /** Dokumen kepabeanan & kargo — khusus impor. */
  pibNumber: string;
  sppbNumber: string;
  mawbNumber: string;
  courierName: string;
  courierMandateNumber: string;
  pickupLocation: string;
  goodsAmount: number;
  goodsAmountLabel: string;
  /** Referensi Purchase Request asal, bila dokumen ini konversi dari PR. */
  purchaseRequestId: string | null;
  purchaseRequestNumber: string;
  notes: string;
  isEditable: boolean;
  isVoidable: boolean;
  isDeletable: boolean;
  createdAt: string;
}

export interface MetalPurchaseDetailVO extends MetalPurchaseVO {
  items: MetalPurchaseItemVO[];
  charges: MetalPurchaseChargeVO[];
  confirmedByName: string;
  confirmedAtLabel: string;
  voidedByName: string;
  voidedAtLabel: string;
  voidReason: string;
  updatedAt: string;
}

export type MetalPurchaseListVO = PaginatedVO<MetalPurchaseVO>;

// ── TTB / Penerimaan ─────────────────────────────────────────────────────────

export interface MetalPurchaseDeliveryLineVO {
  id: string;
  purchaseItemId: string;
  productCode: string;
  productName: string;
  weightGram: number;
  weightGramLabel: string;
  purityPercent: number;
  fineWeightGram: number;
  note: string;
}

export interface MetalPurchaseDeliveryChargeVO {
  id: string;
  lineNo: number;
  name: string;
  amountIdr: number;
  amountIdrLabel: string;
}

export interface MetalPurchaseDeliveryVO {
  id: string;
  number: string;
  status: MetalPurchaseDeliveryStatus;
  statusLabel: string;
  purchaseId: string;
  purchaseNumber: string;
  purchasePaymentType: MetalPurchasePaymentType;
  purchaseType: MetalPurchaseType;
  purchaseTypeLabel: string;
  date: string;
  dateLabel: string;
  courierPartnerName: string;
  trackingNumber: string;
  receivedByName: string;
  corNumber: string;
  supplierDoNumber: string;
  pibNo: string;
  sppbNo: string;
  mawbNo: string;
  barSerialNumbers: string;
  assayCertificateNo: string;
  safeBoxSlot: string;
  securitySealNo: string;
  documentWeightGram: number | null;
  receivedWeightGram: number | null;
  weightDiscrepancyGram: number | null;
  weightDiscrepancyLabel: string;
  notes: string;
  isEditable: boolean;
  isVoidable: boolean;
  isDeletable: boolean;
  createdAt: string;
}

export interface MetalPurchaseDeliveryDetailVO extends MetalPurchaseDeliveryVO {
  lines: MetalPurchaseDeliveryLineVO[];
  charges: MetalPurchaseDeliveryChargeVO[];
  confirmedByName: string;
  confirmedAtLabel: string;
  voidedByName: string;
  voidedAtLabel: string;
  voidReason: string;
  journalNumber: string;
  updatedAt: string;
}

export type MetalPurchaseDeliveryListVO = PaginatedVO<MetalPurchaseDeliveryVO>;
