export interface UnitVO {
  id: string;
  code: string;
  name: string;
  symbol: string;
  label: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  isAnchor: boolean;
  conversionFactor: number;
  ratioToAnchorLabel: string;
  ratioFromAnchorLabel: string;
  isActive: boolean;
  statusLabel: string;
  notes: string;
}

export interface UnitCategoryVO {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  anchorUnitId?: string | null;
  anchorUnitName?: string | null;
  units: UnitVO[];
}

export interface UnitConversionVO {
  fromValue: number;
  fromUnit: UnitVO;
  toUnit: UnitVO;
  anchorUnit: UnitVO;
  anchorValue: number;
  resultValue: number;
  formulaSummary: string;
  ratioFromAnchor: number;
  ratioToAnchor: number;
  steps: string[];
}
