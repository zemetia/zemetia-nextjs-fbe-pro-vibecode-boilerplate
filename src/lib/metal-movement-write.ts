import type { MetalMovementType, Prisma } from '@prisma/client';
import type { MetalMovementDirection } from '@/types/value-objects';

export interface MetalMovementLineInput {
  direction: MetalMovementDirection;
  lotId: string;
  locationId: string;
  pieceCount?: number | null;
  grossWeightGram: number;
  purityPercent: number;
  fineWeightGram: number;
  note?: string | null;
}

export interface CreateMetalMovementInput {
  type: MetalMovementType;
  date: Date;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdById: string;
  lossFineGram?: number;
  alloyGram?: number;
  lines: MetalMovementLineInput[];
}

function movementNumber(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000 + 1000));
  return `MOV-${year}${month}-${rand}`;
}

/**
 * Menulis satu peristiwa mutasi + barisnya, langsung `POSTED` — movement hanya
 * lahir saat kejadian fisiknya sudah pasti (mis. TTB dikonfirmasi), jadi tidak
 * ada tahap draft di jalur ini. Selalu dipanggil dari dalam transaksi milik
 * pemanggil (pola sama `createJournalEntryWithin`) supaya lot, movement, dan
 * jurnal yang menyertainya mendarat bersama atau tidak sama sekali.
 */
export async function createMetalMovement(
  tx: Prisma.TransactionClient,
  input: CreateMetalMovementInput,
) {
  return tx.metalMovement.create({
    data: {
      number: movementNumber(input.date),
      type: input.type,
      status: 'POSTED',
      date: input.date,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      lossFineGram: input.lossFineGram ?? 0,
      alloyGram: input.alloyGram ?? 0,
      notes: input.notes ?? null,
      createdById: input.createdById,
      postedById: input.createdById,
      postedAt: new Date(),
      lines: {
        create: input.lines.map((line) => ({
          direction: line.direction,
          lotId: line.lotId,
          locationId: line.locationId,
          pieceCount: line.pieceCount ?? 0,
          grossWeightGram: line.grossWeightGram,
          purityPercent: line.purityPercent,
          fineWeightGram: line.fineWeightGram,
          note: line.note ?? null,
        })),
      },
    },
    include: { lines: true },
  });
}
