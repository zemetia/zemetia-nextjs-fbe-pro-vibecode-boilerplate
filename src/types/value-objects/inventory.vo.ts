import type {
  BalStageDTO,
  MetalDTO,
  MetalLotFormDTO,
  MetalMovementDirectionDTO,
  MetalMovementStatusDTO,
  MetalMovementTypeDTO,
} from '@/types/dtos';
import type { PaginatedVO } from './pagination.vo';

export type Metal = MetalDTO;
export type MetalLotForm = MetalLotFormDTO;
export type BalStage = BalStageDTO;

export type MetalMovementDirection = MetalMovementDirectionDTO;
export type MetalMovementStatus = MetalMovementStatusDTO;
export type MetalMovementType = MetalMovementTypeDTO;

export interface MetalLotVO {
  id: string;
  code: string;
  form: MetalLotForm;
  formLabel: string;
  metal: Metal;
  metalLabel: string;
  identityLabel: string;
  serialNumber: string;
  certificateNumber: string;
  refinerName: string;
  karat: number | undefined;
  karatLabel: string;
  stoneWeightGram: number | undefined;
  stoneWeightGramLabel: string;
  balStage: BalStage | undefined;
  balStageLabel: string;
  assayedPurityPercent: number | undefined;
  isPurityEstimated: boolean;
  purityPercent: number;
  purityPercentLabel: string;
  grossWeightGram: number;
  grossWeightGramLabel: string;
  fineWeightGram: number;
  fineWeightGramLabel: string;
  remainingGrossWeightGram: number;
  remainingGrossWeightGramLabel: string;
  remainingFineWeightGram: number;
  remainingFineWeightGramLabel: string;
  remainingPieceCount: number;
  remainingPieceCountLabel: string;
  isDepleted: boolean;
  sourceProductionOrderId: string | undefined;
  sourceProductionOrderNumber: string;
  notes: string;
  createdAt: string;
}

export interface MetalLotDetailVO extends MetalLotVO {
  createdByName: string;
  updatedAt: string;
}

export interface StockPositionFormVO {
  form: MetalLotForm;
  formLabel: string;
  lotCount: number;
  lotCountLabel: string;
  grossWeightGram: number;
  grossWeightGramLabel: string;
  fineWeightGram: number;
  fineWeightGramLabel: string;
  pieceCount: number;
  pieceCountLabel: string;
  sharePercent: number;
}

export interface StockPositionMetalVO {
  metal: Metal;
  metalLabel: string;
  fineLabel: string;
  totalFineGram: number;
  totalFineGramLabel: string;
  totalGrossWeightGram: number;
  totalGrossWeightGramLabel: string;
  lotCount: number;
  lotCountLabel: string;
  openBalCount: number;
  openBalCountLabel: string;
  byForm: StockPositionFormVO[];
  isEmpty: boolean;
}

export interface StockPositionVO {
  byMetal: StockPositionMetalVO[];
  isEmpty: boolean;
}

export type MetalLotListVO = PaginatedVO<MetalLotVO>;
