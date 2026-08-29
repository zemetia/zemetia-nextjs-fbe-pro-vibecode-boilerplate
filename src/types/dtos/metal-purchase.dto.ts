import type { MetalDTO } from './inventory.dto';

export type { MetalDTO };

export type MetalPurchaseTypeDTO = 'LOCAL' | 'IMPORT';
export type MetalPurchaseStatusDTO = 'DRAFT' | 'CONFIRMED' | 'VOID';

export type PayableAgingBucketDTO =
  | 'NOT_DUE'
  | 'DUE_0_30'
  | 'DUE_31_60'
  | 'DUE_60_PLUS'
  | 'NO_DUE_DATE';

export interface MoneyTotalDTO {
  currency_code: string;
  amount: number;
}

export interface MetalTotalDTO {
  metal: MetalDTO;
  weight_gram: number;
  fine_weight_gram: number;
}

export interface MetalPurchaseFulfillmentDTO {
  percent: number;
  status: string;
  outstanding: number;
}

export interface MetalPurchaseDTO {
  id: string;
  number: string;
  type: MetalPurchaseTypeDTO;
  date: string;
  status: MetalPurchaseStatusDTO;
  partner_id: string;
  partner_name?: string;
}

export interface MetalPurchaseDetailDTO extends MetalPurchaseDTO {
  notes?: string | null;
}
