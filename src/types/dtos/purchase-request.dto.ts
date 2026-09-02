import type { ApprovalActorRefDTO } from './approval.dto';
import type { MetalDTO } from './inventory.dto';
import type { PaginatedDTO } from './pagination.dto';
import type { ProductFormDTO } from './product.dto';
import type { SupplyCategoryDTO } from './supply.dto';

/// Dipertahankan sebagai sumber kanonik untuk `sales.dto.ts` &
/// `metal-purchase.dto.ts` — dokumen itu masih memakai satuan berat khusus
/// logam. `PurchaseRequestItemDTO` sendiri sudah pindah ke `Unit` master
/// (lihat `unit` di bawah), bukan lagi enum ini.
export type WeightUnitDTO = 'GRAM' | 'TROY_OUNCE';

export type PurchaseRequestCategoryDTO =
  | 'GOLD_IMPORT'
  | 'GOLD_LOCAL'
  | 'SUPPLY'
  | 'CHEMICALS_REFINERY'
  | 'SAFETY_GA';
export type PurchaseRequestPriorityDTO = 'NORMAL' | 'URGENT';

export type PurchaseRequestStatusDTO = 'DRAFT' | 'APPROVED' | 'VOID';

export interface PurchaseRequestSupplyRefDTO {
  id: string;
  code: string;
  name: string;
  category: SupplyCategoryDTO;
  unit: string;
}

export interface PurchaseRequestProductRefDTO {
  id: string;
  code: string;
  name: string;
  metal: MetalDTO;
  form: ProductFormDTO;
}

export interface PurchaseRequestUnitRefDTO {
  id: string;
  code: string;
  symbol: string;
  name: string;
  category_code: string;
  conversion_factor: number;
  is_anchor: boolean;
}

export interface PurchaseRequestItemDTO {
  id: string;
  line_no: number;
  product: PurchaseRequestProductRefDTO | null;
  supply: PurchaseRequestSupplyRefDTO | null;
  unit: PurchaseRequestUnitRefDTO;
  quantity: number;
  est_unit_price: number;
  est_amount: number;
  ordered_quantity: number;
  outstanding_quantity: number;
  notes: string | null;
}

export interface PurchaseRequestDTO {
  id: string;
  number: string;
  status: PurchaseRequestStatusDTO;
  category: PurchaseRequestCategoryDTO;
  date: string;
  required_date: string | null;
  department: string;
  priority: PurchaseRequestPriorityDTO;
  suggested_partner: { id: string; name: string } | null;
  currency_code: string;
  est_total_amount: number;
  is_fulfilled: boolean;
  is_partially_fulfilled: boolean;
  /** Field legacy (`src/dto/purchaseRequest.dto.js`) — dipertahankan agar
   *  dokumen lama & form legacy tetap terbaca sama. */
  requester_name: string | null;
  recommended_supplier: string | null;
  /** Jejak konversi ke PO (legacy `convertedPoNumber`/`conversionDate`/`convertedBy`). */
  converted_po_number: string | null;
  conversion_date: string | null;
  converted_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseRequestDetailDTO extends PurchaseRequestDTO {
  items: PurchaseRequestItemDTO[];
  created_by: ApprovalActorRefDTO | null;
  approved_by: ApprovalActorRefDTO | null;
  approved_at: string | null;
  voided_by: ApprovalActorRefDTO | null;
  voided_at: string | null;
  void_reason: string | null;
  updated_at: string;
}

export type PurchaseRequestListDTO = PaginatedDTO<PurchaseRequestDTO>;
