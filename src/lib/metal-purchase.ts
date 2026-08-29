import { fineWeight } from '@/lib/metal-lot';
import { roundTo } from '@/lib/number';
import { toGram, WEIGHT_SCALE } from '@/lib/weight';
import type { PriceBasis, WeightUnit } from '@/types/value-objects';

export const METAL_PURCHASE_PRICE_SCALE = 8;

export const METAL_PURCHASE_TYPES = ['LOCAL', 'IMPORT'] as const;

export const METAL_PURCHASE_STATUSES = ['DRAFT', 'CONFIRMED', 'VOID'] as const;

export const METAL_PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Terkonfirmasi',
  RECEIVED: 'Diterima',
  VOID: 'Dibatalkan',
};

export const METAL_PURCHASE_TYPE_LABELS: Record<string, string> = {
  LOCAL: 'Lokal (IDR)',
  IMPORT: 'Impor (Valas)',
};

export const METAL_PURCHASE_TYPE_OPTIONS = [
  { value: 'LOCAL', label: 'Lokal (IDR)' },
  { value: 'IMPORT', label: 'Impor (Valas)' },
];

export const METAL_PURCHASE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Terkonfirmasi' },
  { value: 'VOID', label: 'Dibatalkan' },
];

export interface MetalPurchaseItemInput {
  weight: number;
  weightUnit?: WeightUnit;
  purityPercent: number;
  pure: boolean;
  priceBasis: PriceBasis;
  pricePerUnit: number;
}

export interface MetalPurchaseItemComputed {
  weightGram: number;
  fineWeightGram: number;
  amount: number;
}

export function computeMetalPurchaseItem(input: MetalPurchaseItemInput): MetalPurchaseItemComputed {
  const weightGram = toGram(input.weight, input.weightUnit ?? 'GRAM');
  const fineWeightGram = fineWeight(weightGram, input.purityPercent, { pure: input.pure });
  const amount = roundTo(input.weight * input.pricePerUnit, 2);

  return {
    weightGram: roundTo(weightGram, WEIGHT_SCALE),
    fineWeightGram: roundTo(fineWeightGram, WEIGHT_SCALE),
    amount,
  };
}
