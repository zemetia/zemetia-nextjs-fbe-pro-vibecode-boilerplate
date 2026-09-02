import type { PaginatedDTO } from './pagination.dto';

export type MetalDTO = 'GOLD' | 'SILVER';

export type MetalLotFormDTO = 'BAR' | 'GRANULE' | 'JEWELRY' | 'SCRAP' | 'BAL';

export type BalStageDTO = 'OPEN' | 'SEALED';

export type MetalMovementDirectionDTO = 'IN' | 'OUT';
export type MetalMovementStatusDTO = 'DRAFT' | 'POSTED' | 'VOID';
export type MetalMovementTypeDTO =
  | 'RECEIPT'
  | 'SORT'
  | 'TRANSFER'
  | 'REFINE_OUT'
  | 'REFINE_IN'
  | 'PRODUCTION'
  | 'ISSUE'
  | 'ADJUSTMENT';

export interface StorageLocationRefDTO {
  id: string;
  code: string;
  name: string;
}

export interface MetalLotDTO {
  id: string;
  code: string;
  form: MetalLotFormDTO;
  metal: MetalDTO;

  serial_number: string | null;
  certificate_number: string | null;
  refiner_name: string | null;

  karat: number | null;
  piece_count: number | null;
  stone_weight_gram: number | null;

  bal_stage: BalStageDTO | null;
  assayed_purity_percent: number | null;

  purity_percent: number;
  gross_weight_gram: number;
  fine_weight_gram: number;

  remaining_gross_weight_gram: number;
  remaining_fine_weight_gram: number;
  remaining_piece_count: number;

  source_production_order: { id: string; number: string } | null;
  notes: string | null;
  created_at: string;
}

export interface MetalLotDetailDTO extends MetalLotDTO {
  created_by: { id: string; name: string | null } | null;
  updated_at: string;
}

export interface StockPositionMetalDTO {
  metal: MetalDTO;
  total_fine_gram: number;
  total_gross_weight_gram: number;
  lot_count: number;
  by_form: {
    form: MetalLotFormDTO;
    lot_count: number;
    gross_weight_gram: number;
    fine_weight_gram: number;
    piece_count: number;
  }[];
  open_bal_count: number;
}

export interface StockPositionDTO {
  by_metal: StockPositionMetalDTO[];
}

export type MetalLotListDTO = PaginatedDTO<MetalLotDTO>;
