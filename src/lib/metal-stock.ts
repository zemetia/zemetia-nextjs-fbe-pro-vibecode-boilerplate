import type { Metal, MetalLotForm } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { roundTo } from '@/lib/number';
import { WEIGHT_SCALE } from '@/lib/metal-lot';
import { METALS } from '@/lib/product';
import type { StockPositionDTO, StockPositionMetalDTO } from '@/types/dtos';

/**
 * Sisa stok tiap lot adalah turunan dari `MetalMovementLine` — **bukan** kolom
 * `MetalLot.grossWeightGram`/`fineWeightGram`, yang tetap berat asli lot itu
 * lahir (dipakai label & sertifikat, tidak pernah berkurang). `Σ IN − Σ OUT`
 * pada baris movement `POSTED` adalah satu-satunya jawaban "berapa sisanya
 * sekarang" — pola yang sama dengan saldo akun yang diturunkan dari
 * `journal_lines` (`docs/blueprint/ACCOUNTING.md`).
 */

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

const sign = (direction: 'IN' | 'OUT'): 1 | -1 => (direction === 'IN' ? 1 : -1);

/** What each lot holds — netted across every `POSTED` movement line touching it. */
export async function lotBalances(lotIds: readonly string[]): Promise<Map<string, LotBalance>> {
  if (lotIds.length === 0) return new Map();

  const lines = await prisma.metalMovementLine.findMany({
    where: { lotId: { in: [...lotIds] }, movement: { status: 'POSTED' } },
    select: {
      lotId: true,
      direction: true,
      pieceCount: true,
      grossWeightGram: true,
      fineWeightGram: true,
    },
  });

  const balances = new Map<string, LotBalance>();
  for (const line of lines) {
    const current = balances.get(line.lotId) ?? { ...EMPTY_BALANCE };
    const factor = sign(line.direction);

    balances.set(line.lotId, {
      grossWeightGram: current.grossWeightGram + factor * Number(line.grossWeightGram),
      fineWeightGram: current.fineWeightGram + factor * Number(line.fineWeightGram),
      pieceCount: current.pieceCount + factor * line.pieceCount,
    });
  }

  for (const [lotId, balance] of balances) {
    balances.set(lotId, round(balance));
  }

  return balances;
}

export function balanceOf(balances: Map<string, LotBalance>, lotId: string): LotBalance {
  return balances.get(lotId) ?? EMPTY_BALANCE;
}

/** Breakdown sisa satu lot per lokasi fisik — dipakai halaman detail lot. */
export async function positionsOfLot(
  lotId: string,
): Promise<{ locationId: string; locationCode: string; locationName: string; balance: LotBalance }[]> {
  const lines = await prisma.metalMovementLine.findMany({
    where: { lotId, movement: { status: 'POSTED' } },
    select: {
      direction: true,
      pieceCount: true,
      grossWeightGram: true,
      fineWeightGram: true,
      location: { select: { id: true, code: true, name: true } },
    },
  });

  const byLocation = new Map<
    string,
    { locationCode: string; locationName: string; balance: LotBalance }
  >();

  for (const line of lines) {
    const current = byLocation.get(line.location.id) ?? {
      locationCode: line.location.code,
      locationName: line.location.name,
      balance: { ...EMPTY_BALANCE },
    };
    const factor = sign(line.direction);

    current.balance = {
      grossWeightGram: current.balance.grossWeightGram + factor * Number(line.grossWeightGram),
      fineWeightGram: current.balance.fineWeightGram + factor * Number(line.fineWeightGram),
      pieceCount: current.balance.pieceCount + factor * line.pieceCount,
    };
    byLocation.set(line.location.id, current);
  }

  return [...byLocation.entries()]
    .map(([locationId, entry]) => ({
      locationId,
      locationCode: entry.locationCode,
      locationName: entry.locationName,
      balance: round(entry.balance),
    }))
    .filter((row) => row.balance.grossWeightGram > 0 || row.balance.pieceCount > 0);
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
      select: { id: true, form: true, metal: true },
    }),
    prisma.metalLot.groupBy({
      by: ['metal'],
      where: { form: 'BAL', balStage: 'OPEN' },
      _count: { _all: true },
    }),
  ]);

  const balances = await lotBalances(lots.map((lot) => lot.id));

  const buckets = new Map<Metal, MetalBucket>(
    METALS.map((metal) => [metal, { byForm: new Map() }]),
  );

  for (const lot of lots) {
    const balance = balanceOf(balances, lot.id);
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
