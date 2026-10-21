import type { PriceBasisDTO } from './product.dto';
import type { WeightUnitDTO } from './purchase-request.dto';

export type { PriceBasisDTO, WeightUnitDTO };

export type MetalPurchaseTypeDTO = 'LOCAL' | 'IMPORT' | 'SCRAP_LOCAL';
export type MetalPurchasePaymentTypeDTO = 'PO' | 'DP';
export type MetalPurchaseStatusDTO = 'DRAFT' | 'CONFIRMED' | 'VOID';
export type MetalPurchasePaymentStatusDTO = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type MetalPurchaseDeliveryStatusDTO = 'DRAFT' | 'IN_TRANSIT' | 'CONFIRMED' | 'VOID';

export interface MetalPurchasePartnerRefDTO {
  id: string;
  code: string;
  name: string;
}

export interface MetalPurchaseProductRefDTO {
  id: string;
  code: string;
  name: string;
}

export interface MetalPurchaseItemDTO {
  id: string;
  line_no: number;
  product: MetalPurchaseProductRefDTO;
  weight_unit: WeightUnitDTO;
  weight_gram: number;
  purity_percent: number;
  fine_weight_gram: number;
  price_basis: PriceBasisDTO;
  price_per_unit: number;
  amount: number;
  notes: string | null;
}

export interface MetalPurchaseChargeDTO {
  id: string;
  line_no: number;
  name: string;
  amount_idr: number;
}

export interface MetalPurchasePaymentDTO {
  id: string;
  line_no: number;
  voucher_no: string | null;
  voucher_type: string | null;
  date: string | null;
  category: string;
  category_label: string | null;
  payee: string | null;
  bank: string | null;
  bank_account_code: string | null;
  account_code: string | null;
  amount: number;
  notes: string | null;
}

export interface MetalPurchaseDTO {
  id: string;
  number: string;
  type: MetalPurchaseTypeDTO;
  payment_type: MetalPurchasePaymentTypeDTO;
  status: MetalPurchaseStatusDTO;
  partner: MetalPurchasePartnerRefDTO;
  date: string;
  due_date: string | null;
  supplier_invoice_number: string | null;
  currency_code: string;
  exchange_rate: number | null;
  /** Dokumen kepabeanan & kargo — khusus impor. */
  pib_number: string | null;
  sppb_number: string | null;
  mawb_number: string | null;
  courier_name: string | null;
  courier_mandate_number: string | null;
  pickup_location: string | null;
  goods_amount: number;
  notes: string | null;
  /** Pelacakan pembayaran (cermin legacy `pttan_local_purchases`). */
  payment_status: MetalPurchasePaymentStatusDTO;
  paid_amount_idr: number;
  remaining_balance_idr: number | null;
  /** Referensi PR asal + nomornya (legacy `prId`/`prNumber`). */
  purchase_request_id: string | null;
  purchase_request_number: string | null;
  created_at: string;
}

export interface MetalPurchaseDetailDTO extends MetalPurchaseDTO {
  items: MetalPurchaseItemDTO[];
  charges: MetalPurchaseChargeDTO[];
  payments: MetalPurchasePaymentDTO[];
  confirmed_by: { id: string; name: string | null } | null;
  confirmed_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  updated_at: string;
}

export type MetalPurchaseListDTO = import('./pagination.dto').PaginatedDTO<MetalPurchaseDTO>;

// ── TTB / Penerimaan ─────────────────────────────────────────────────────────

export interface MetalPurchaseDeliveryLineDTO {
  id: string;
  purchase_item_id: string;
  product: MetalPurchaseProductRefDTO;
  weight_gram: number;
  purity_percent: number;
  fine_weight_gram: number;
  note: string | null;
}

export interface MetalPurchaseDeliveryChargeDTO {
  id: string;
  line_no: number;
  name: string;
  amount_idr: number;
}

export interface MetalPurchaseDeliveryDTO {
  id: string;
  number: string;
  status: MetalPurchaseDeliveryStatusDTO;
  purchase: {
    id: string;
    number: string;
    payment_type: MetalPurchasePaymentTypeDTO;
    type: MetalPurchaseTypeDTO;
  };
  date: string;
  courier_partner: MetalPurchasePartnerRefDTO | null;
  tracking_number: string | null;
  received_by_name: string | null;
  cor_number: string | null;
  /** Nomor surat jalan supplier (beda dokumen dari resi kurir). */
  supplier_do_number: string | null;
  /** Dokumen kepabeanan — khusus PO tipe IMPORT. */
  pib_no: string | null;
  sppb_no: string | null;
  mawb_no: string | null;
  /** Nomor sertifikat/seri keping batangan, dipisah koma — lahir dari `CertificatesInput`. */
  bar_serial_numbers: string | null;
  /** Nomor sertifikat assay kemurnian — dari lab uji kadar saat fisik tiba. */
  assay_certificate_no: string | null;
  /** Laci/slot brankas tujuan & nomor segel keamanan — input operator fisik saat TTB. */
  safe_box_slot: string | null;
  security_seal_no: string | null;
  /** Komparator timbangan: dokumen vs aktual, dan selisihnya. Dihitung server. */
  document_weight_gram: number | null;
  received_weight_gram: number | null;
  weight_discrepancy_gram: number | null;
  notes: string | null;
  created_at: string;
}

export interface MetalPurchaseDeliveryDetailDTO extends MetalPurchaseDeliveryDTO {
  lines: MetalPurchaseDeliveryLineDTO[];
  charges: MetalPurchaseDeliveryChargeDTO[];
  confirmed_by: { id: string; name: string | null } | null;
  confirmed_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  journal: { id: string; number: string; status: string } | null;
  updated_at: string;
}

export type MetalPurchaseDeliveryListDTO =
  import('./pagination.dto').PaginatedDTO<MetalPurchaseDeliveryDTO>;
