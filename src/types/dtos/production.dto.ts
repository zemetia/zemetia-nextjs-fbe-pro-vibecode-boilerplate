import type { PaginatedDTO } from './pagination.dto';

export type ProductionOrderStatusDTO = 'DRAFT' | 'RELEASED' | 'CLOSED' | 'VOID';

export interface ProductionBalanceDTO {
  issued_fine_gram: number;
  returned_fine_gram: number;
  consumed_fine_gram: number;
  output_fine_gram: number;
  output_gross_weight_gram: number;
  output_piece_count: number;
  loss_fine_gram: number;
  alloy_gram: number;
  wip_fine_gram: number;
  loss_percent: number;
  yield_percent: number;
  is_over_loss_tolerance: boolean;
}

export interface ProductionOrderDTO {
  id: string;
  number: string;
  status: ProductionOrderStatusDTO;
  date: string;
  target_date: string | null;

  model_name: string | null;
  karat: number;
  purity_percent: number;

  target_gross_weight_gram: number;
  target_piece_count: number | null;
  fine_needed_gram: number;
  alloy_needed_gram: number;

  location_name: string | null;
  loss_tolerance_percent: number;

  balance: ProductionBalanceDTO;

  notes: string | null;
  created_at: string;
}

export interface ProductionOrderDetailDTO extends ProductionOrderDTO {
  close_note: string | null;
  created_by: { id: string; name: string | null } | null;
  released_by: { id: string; name: string | null } | null;
  released_at: string | null;
  closed_by: { id: string; name: string | null } | null;
  closed_at: string | null;
  voided_by: { id: string; name: string | null } | null;
  voided_at: string | null;
  void_reason: string | null;
  updated_at: string;
}

export type ProductionOrderListDTO = PaginatedDTO<ProductionOrderDTO>;
