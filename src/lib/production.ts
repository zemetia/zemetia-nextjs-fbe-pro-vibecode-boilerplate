import { roundTo } from '@/lib/number';
import { WEIGHT_SCALE } from '@/lib/metal-lot';
import type { ProductionOrderStatus } from '@/types/value-objects';

/**
 * Vocabulary and arithmetic of one work order (SPK). Pure on purpose — the
 * gateway that writes gold lives in `production-write.ts` and reaches for
 * Prisma, which the client bundle must never pull in.
 *
 * Every derivation here is used twice: once by the form to preview a plan, and
 * once by the route handler to store the result. Two implementations of the same
 * sum is how a screen and a database end up disagreeing about one order.
 */

export const REFERENCE_TYPE_PRODUCTION_ORDER = 'PRODUCTION_ORDER';

export const PRODUCTION_ORDER_STATUSES = ['DRAFT', 'RELEASED', 'CLOSED', 'VOID'] as const;

export const PRODUCTION_ORDER_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  DRAFT: 'Draft',
  RELEASED: 'Dirilis',
  CLOSED: 'Selesai',
  VOID: 'Dibatalkan',
};

export const PRODUCTION_ORDER_STATUS_DESCRIPTIONS: Record<ProductionOrderStatus, string> = {
  DRAFT: 'Baru rencana — masih bisa diubah dan dihapus, belum menyentuh emas.',
  RELEASED: 'Sudah di lantai produksi — bahan boleh keluar dan hasil boleh dicatat.',
  CLOSED: 'Selesai — sisa bahan sudah nol dan susutnya terkunci.',
  VOID: 'Dibatalkan; catatannya tetap disimpan.',
};

export const PRODUCTION_ORDER_STATUS_OPTIONS = PRODUCTION_ORDER_STATUSES.map((value) => ({
  value,
  label: PRODUCTION_ORDER_STATUS_LABELS[value],
}));

/** Only a draft is still a piece of paper; everything after it has touched gold. */
export function isProductionOrderEditable(status: ProductionOrderStatus): boolean {
  return status === 'DRAFT';
}

/** Gold may only move for an order that has actually been released to the floor. */
export function acceptsMetalMovement(status: ProductionOrderStatus): boolean {
  return status === 'RELEASED';
}

export function canReleaseProductionOrder(status: ProductionOrderStatus): boolean {
  return status === 'DRAFT';
}

export function canCloseProductionOrder(status: ProductionOrderStatus): boolean {
  return status === 'RELEASED';
}

export function canVoidProductionOrder(status: ProductionOrderStatus): boolean {
  return status === 'DRAFT' || status === 'RELEASED';
}

export interface MaterialPlan {
  /** Emas murni yang harus masuk untuk mencapai berat kotor target. */
  fineNeededGram: number;
  /** Sisanya adalah logam campur — bukan emas, jadi tidak masuk neraca emas. */
  alloyNeededGram: number;
}

/**
 * What the order asks for, expressed as material. 18K berarti tiga per empat
 * beratnya emas: 100 g kalung 18K menuntut 75 g emas murni dan 25 g alloy.
 *
 * Dibulatkan ke skala kolomnya lebih dulu supaya angka di layar bisa dijumlah
 * ulang dengan tangan dan tetap sama dengan yang tersimpan.
 */
export function materialPlan(targetGrossWeightGram: number, purityPercent: number): MaterialPlan {
  const fine = roundTo((targetGrossWeightGram * purityPercent) / 100, WEIGHT_SCALE);

  return {
    fineNeededGram: fine,
    alloyNeededGram: roundTo(targetGrossWeightGram - fine, WEIGHT_SCALE),
  };
}

/**
 * Susut selalu diukur terhadap emas yang **benar-benar diolah**, bukan terhadap
 * rencana: SPK yang baru mengolah separuh bahannya tidak boleh terlihat boros
 * hanya karena pembaginya angka rencana.
 */
export function lossPercentOf(lossFineGram: number, consumedFineGram: number): number {
  if (consumedFineGram <= 0) return 0;
  return roundTo((lossFineGram / consumedFineGram) * 100, 4);
}

/** Berapa persen emas yang diolah berakhir sebagai barang — kebalikan susut. */
export function yieldPercentOf(outputFineGram: number, consumedFineGram: number): number {
  if (consumedFineGram <= 0) return 0;
  return roundTo((outputFineGram / consumedFineGram) * 100, 4);
}

export function isOverLossTolerance(lossPercent: number, tolerancePercent: number): boolean {
  return lossPercent > tolerancePercent;
}
