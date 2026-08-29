import type { Metal, MetalLotForm } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { roundTo } from '@/lib/number';
import { WEIGHT_SCALE } from '@/lib/metal-lot';
import { METALS } from '@/lib/product';
import type { StockPositionDTO, StockPositionMetalDTO } from '@/types/dtos';

export interface LotBalance {
  grossWeightGram: number;
  fineWeightGram: number;
  pieceCount: number;
}

const EMPTY_BALANCE: LotBalance = { grossWeightGram: 0, fineWeightGram: 0, pieceCount: 0 };

function round(balance: LotBalance): LotBalance {
  return {
    grossWeightGram: roundTo(balance.grossWeightGram, WEIGHT_SCALE),
    fineWeightGram: roundTo(balance.fineWeightGram, WEIGHT_SCALE),
    pieceCount: balance.pieceCount,
  };
}

/** What each lot holds. */
export async function lotBalances(lotIds: readonly string[]): Promise<Map<string, LotBalance>> {
  if (lotIds.length === 0) return new Map();

  const lots = await prisma.metalLot.findMany({
    where: { id: { in: [...lotIds] } },
    select: { id: true, grossWeightGram: true, fineWeightGram: true, pieceCount: true },
  });

  const balances = new Map<string, LotBalance>();
  for (const lot of lots) {
    balances.set(
      lot.id,
      round({
        grossWeightGram: Number(lot.grossWeightGram),
        fineWeightGram: Number(lot.fineWeightGram),
        pieceCount: lot.pieceCount ?? 0,
      }),
    );
  }

  return balances;
}

export function balanceOf(balances: Map<string, LotBalance>, lotId: string): LotBalance {
  return balances.get(lotId) ?? EMPTY_BALANCE;
}

export async function positionsOfLot(_lotId: string): Promise<never[]> {
  return [];
}

type CountedBalance = LotBalance & { lotCount: number };

const EMPTY_COUNTED: CountedBalance = { ...EMPTY_BALANCE, lotCount: 0 };

function addLot(current: CountedBalance, balance: LotBalance): CountedBalance {
  return {
    grossWeightGram: current.grossWeightGram + balance.grossWeightGram,
    fineWeightGram: current.fineWeightGram + balance.fineWeightGram,
    pieceCount: current.pieceCount + balance.pieceCount,
    lotCount: current.lotCount + 1,
  };
}

interface MetalBucket {
  byForm: Map<MetalLotForm, CountedBalance>;
}

export async function stockPositions(): Promise<StockPositionDTO> {
  const [lots, openBalRows] = await Promise.all([
    prisma.metalLot.findMany({
      select: {
        id: true,
        form: true,
        metal: true,
        grossWeightGram: true,
        fineWeightGram: true,
        pieceCount: true,
      },
    }),
    prisma.metalLot.groupBy({
      by: ['metal'],
      where: { form: 'BAL', balStage: 'OPEN' },
      _count: { _all: true },
    }),
  ]);

  const buckets = new Map<Metal, MetalBucket>(
    METALS.map((metal) => [metal, { byForm: new Map() }]),
  );

  for (const lot of lots) {
    const balance = round({
      grossWeightGram: Number(lot.grossWeightGram),
      fineWeightGram: Number(lot.fineWeightGram),
      pieceCount: lot.pieceCount ?? 0,
    });

    if (balance.grossWeightGram <= 0 && balance.pieceCount <= 0) continue;

    const bucket = buckets.get(lot.metal);
    if (!bucket) continue;

    bucket.byForm.set(lot.form, addLot(bucket.byForm.get(lot.form) ?? EMPTY_COUNTED, balance));
  }

  const openBalOf = new Map(openBalRows.map((row) => [row.metal, row._count._all]));

  return {
    by_metal: METALS.map((metal): StockPositionMetalDTO => {
      const bucket = buckets.get(metal) ?? { byForm: new Map() };
      const forms = [...bucket.byForm.values()];

      return {
        metal,
        total_fine_gram: roundTo(
          forms.reduce((sum, entry) => sum + entry.fineWeightGram, 0),
          WEIGHT_SCALE,
        ),
        total_gross_weight_gram: roundTo(
          forms.reduce((sum, entry) => sum + entry.grossWeightGram, 0),
          WEIGHT_SCALE,
        ),
        lot_count: forms.reduce((sum, entry) => sum + entry.lotCount, 0),
        open_bal_count: openBalOf.get(metal) ?? 0,
        by_form: [...bucket.byForm]
          .map(([form, entry]) => ({
            form,
            lot_count: entry.lotCount,
            gross_weight_gram: roundTo(entry.grossWeightGram, WEIGHT_SCALE),
            fine_weight_gram: roundTo(entry.fineWeightGram, WEIGHT_SCALE),
            piece_count: entry.pieceCount,
          }))
          .sort((a, b) => b.fine_weight_gram - a.fine_weight_gram),
      };
    }),
  };
}
