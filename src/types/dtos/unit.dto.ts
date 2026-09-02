export interface UnitDTO {
  id: string;
  code: string;
  name: string;
  symbol: string;
  category_id: string;
  category_code?: string;
  category_name?: string;
  is_anchor: boolean;
  conversion_factor: number;
  is_active: boolean;
  notes: string | null;
}

export interface UnitCategoryDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  anchor_unit_id?: string | null;
  anchor_unit_name?: string | null;
  units?: UnitDTO[];
}

export interface UnitConversionRequestDTO {
  value: number;
  from_unit_code: string;
  to_unit_code: string;
}

export interface UnitConversionResponseDTO {
  from_value: number;
  from_unit: UnitDTO;
  to_unit: UnitDTO;
  anchor_unit: UnitDTO;
  anchor_value: number;
  result_value: number;
  formula_summary: string;
  ratio_from_anchor: number;
  ratio_to_anchor: number;
  steps: string[];
}
