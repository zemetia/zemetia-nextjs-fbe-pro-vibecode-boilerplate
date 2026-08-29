import type { ApprovalActorRefDTO } from './approval.dto';
import type { MetalDTO } from './inventory.dto';
import type { PaginatedDTO } from './pagination.dto';
import type { ProductFormDTO } from './product.dto';
import type { SupplyCategoryDTO } from './supply.dto';

export type WeightUnitDTO = 'GRAM' | 'TROY_OUNCE';

export type PurchaseRequestCategoryDTO = 'GOLD_IMPORT' | 'GOLD_LOCAL' | 'SUPPLY';
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

export interface PurchaseRequestItemDTO {
  id: string;
  line_no: number;
  product: PurchaseRequestProductRefDTO | null;
  supply: PurchaseRequestSupplyRefDTO | null;
  weight_unit: WeightUnitDTO | null;
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
