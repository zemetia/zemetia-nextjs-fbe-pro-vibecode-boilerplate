import type { Prisma } from '@prisma/client';
import type { MetalMovementDirection } from '@/types/value-objects';

export interface MetalMovementLineInput {
  direction: MetalMovementDirection;
  lotId: string;
  locationId: string;
  pieceCount?: number | null;
  grossWeightGram: number;
  purityPercent: number;
  fineWeightGram?: number;
  note?: string | null;
}

export interface CreateMetalMovementInput {
  type: string;
  date: Date;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdById: string;
  lossFineGram?: number;
  alloyGram?: number;
  inFineGram?: number;
  outFineGram?: number;
  lines: MetalMovementLineInput[];
}

export async function createMetalMovement(
  _tx: Prisma.TransactionClient,
  _input: CreateMetalMovementInput,
) {
  // Movement ledger integration stub
  return { id: 'mock-movement-id' };
}
