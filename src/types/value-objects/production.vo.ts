import type { ProductionOrderStatusDTO } from '@/types/dtos';
import type { PaginatedVO } from './pagination.vo';

export type ProductionOrderStatus = ProductionOrderStatusDTO;

export interface ProductionBalanceVO {
  issuedFineGram: number;
  issuedFineGramLabel: string;
  returnedFineGram: number;
  returnedFineGramLabel: string;
  consumedFineGram: number;
  consumedFineGramLabel: string;
  outputFineGram: number;
  outputFineGramLabel: string;
  outputGrossWeightGram: number;
  outputGrossWeightGramLabel: string;
  outputPieceCount: number;
  outputPieceCountLabel: string;
  lossFineGram: number;
  lossFineGramLabel: string;
  alloyGram: number;
  alloyGramLabel: string;
  wipFineGram: number;
  wipFineGramLabel: string;
  lossPercent: number;
  lossPercentLabel: string;
  yieldPercent: number;
  yieldPercentLabel: string;
  isOverLossTolerance: boolean;
  hasMaterialOnFloor: boolean;
}

export interface ProductionOrderVO {
  id: string;
  number: string;
  status: ProductionOrderStatus;
  statusLabel: string;
  date: string;
  dateLabel: string;
  targetDate: string | undefined;
  targetDateLabel: string;

  modelName: string;
  karat: number;
  karatLabel: string;
  purityPercent: number;
  purityPercentLabel: string;

  targetGrossWeightGram: number;
  targetGrossWeightGramLabel: string;
  targetPieceCount: number | undefined;
  targetPieceCountLabel: string;
  fineNeededGram: number;
  fineNeededGramLabel: string;
  alloyNeededGram: number;
  alloyNeededGramLabel: string;

  locationName: string;
  lossTolerancePercent: number;
  lossTolerancePercentLabel: string;

  balance: ProductionBalanceVO;

  progressPercent: number;

  isEditable: boolean;
  canRelease: boolean;
  canRecordMovement: boolean;
  canClose: boolean;
  canVoid: boolean;

  notes: string;
  createdAt: string;
}

export interface ProductionOrderDetailVO extends ProductionOrderVO {
  closeNote: string;
  createdByName: string;
  releasedByName: string;
  releasedAt: string | undefined;
  closedByName: string;
  closedAt: string | undefined;
  voidedByName: string;
  voidedAt: string | undefined;
  voidReason: string;
  updatedAt: string;
}

export type ProductionOrderListVO = PaginatedVO<ProductionOrderVO>;
