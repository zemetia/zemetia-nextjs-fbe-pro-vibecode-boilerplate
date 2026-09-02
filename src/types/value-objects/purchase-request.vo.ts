import type {
  PurchaseRequestCategoryDTO,
  PurchaseRequestPriorityDTO,
  PurchaseRequestStatusDTO,
  WeightUnitDTO,
} from '@/types/dtos';
import type { Metal } from './inventory.vo';
import type { PaginatedVO } from './pagination.vo';
import type { ProductForm } from './product.vo';
import type { SupplyCategory } from './supply.vo';
import type { UnitVO } from './unit.vo';

export type WeightUnit = WeightUnitDTO;
export type PurchaseRequestCategory = PurchaseRequestCategoryDTO;
export type PurchaseRequestPriority = PurchaseRequestPriorityDTO;
export type PurchaseRequestStatus = PurchaseRequestStatusDTO;

export type PurchaseRequestStage = PurchaseRequestStatus | 'CONVERTED';

export interface PurchaseRequestItemVO {
  id: string;
  lineNo: number;
  itemLabel: string;
  itemCode: string;
  productId?: string;
  supplyId?: string;
  metal?: Metal;
  form?: ProductForm;
  supplyCategory?: SupplyCategory;
  unit: Pick<UnitVO, 'id' | 'code' | 'symbol' | 'name' | 'categoryCode' | 'conversionFactor' | 'isAnchor'>;
  unitLabel: string;
  quantity: number;
  quantityLabel: string;
  estUnitPrice: number;
  estUnitPriceLabel: string;
  estAmount: number;
  estAmountLabel: string;
  orderedQuantity: number;
  orderedQuantityLabel: string;
  outstandingQuantity: number;
  outstandingQuantityLabel: string;
  isFulfilled: boolean;
  notes: string;
}

export interface PurchaseRequestVO {
  id: string;
  number: string;
  status: PurchaseRequestStatus;
  stage: PurchaseRequestStage;
  stageLabel: string;
  category: PurchaseRequestCategory;
  categoryLabel: string;
  date: string;
  dateLabel: string;
  requiredDate?: string;
  requiredDateLabel: string;
  department: string;
  priority: PurchaseRequestPriority;
  priorityLabel: string;
  isUrgent: boolean;
  suggestedPartnerId?: string;
  suggestedPartnerName: string;
  currencyCode: string;
  estTotalAmount: number;
  estTotalAmountLabel: string;
  isFulfilled: boolean;
  isPartiallyFulfilled: boolean;

  isEditable: boolean;
  canApprove: boolean;
  canVoid: boolean;
  canDelete: boolean;
  canConvert: boolean;

  notes: string;
  createdAt: string;
}

export interface PurchaseRequestPurchaseRefVO {
  id: string;
  number: string;
  dateLabel: string;
  statusLabel: string;
  partnerName: string;
}

export interface PurchaseRequestDetailVO extends PurchaseRequestVO {
  items: PurchaseRequestItemVO[];
  purchases?: PurchaseRequestPurchaseRefVO[];
  createdByName: string;
  approvedByName: string;
  approvedAt?: string;
  voidedByName: string;
  voidedAt?: string;
  voidReason: string;
  updatedAt: string;
}

export type PurchaseRequestListVO = PaginatedVO<PurchaseRequestVO>;
