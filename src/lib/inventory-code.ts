import type { MetalLotForm, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { METAL_LOT_CODE_PREFIX } from '@/lib/metal-lot';

/**
 * Server-side code generators for the inventory module, following the pattern
 * `MTR-0001` set by partners: the next code is derived from the highest existing
 * one and a concurrent insert is absorbed by retrying the unique violation,
 * rather than by locking the table.
 *
 * Ordering by `length` first keeps the sequence numeric past `BAR-9999` — plain
 * lexicographic ordering ranks `BAR-9999` above `BAR-10000`, which would freeze
 * the sequence forever at the four-digit mark.
 */

const SEQUENCE_DIGITS = 4;
const MAX_ATTEMPTS = 5;

function format(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

function sequenceOf(code: string): number {
  const parsed = Number(code.split('-').at(-1));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lot codes inside somebody else's transaction cannot lean on the
 * retry-on-conflict generator — a failed statement has already aborted the
 * transaction — so the sequence is read once and counted up locally by the
 * caller. The unique index is still the last word.
 */
export async function nextLotCodeSequence(
  form: MetalLotForm,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const prefix = METAL_LOT_CODE_PREFIX[form];
  const rows = await tx.$queryRaw<{ code: string }[]>`
    SELECT code FROM metal_lots WHERE code LIKE ${`${prefix}-%`}
    ORDER BY length(code) DESC, code DESC LIMIT 1
  `;

  return rows[0] ? sequenceOf(rows[0].code) + 1 : 1;
}

export function lotCodeAt(form: MetalLotForm, sequence: number): string {
  return format(METAL_LOT_CODE_PREFIX[form], sequence);
}

async function nextLotCode(form: MetalLotForm): Promise<string> {
  const prefix = METAL_LOT_CODE_PREFIX[form];
  const rows = await prisma.$queryRaw<{ code: string }[]>`
    SELECT code FROM metal_lots WHERE code LIKE ${`${prefix}-%`}
    ORDER BY length(code) DESC, code DESC LIMIT 1
  `;

  return format(prefix, rows[0] ? sequenceOf(rows[0].code) + 1 : 1);
}

export async function createWithLotCode<T>(
  form: MetalLotForm,
  create: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextLotCode(form));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Kode lot gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
