import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { formatPartnerCode, parsePartnerCodeSequence } from '@/lib/partner';

/**
 * Server-side generator for the `MTR-0001` code. There is no sequence object
 * backing it — the code is derived from the highest existing one, so a
 * concurrent insert can lose the race. `createWithPartnerCode` absorbs that by
 * retrying on the unique violation instead of pre-locking the table.
 */

const MAX_ATTEMPTS = 5;

/**
 * Ordering by `length` first keeps the sequence numeric past `MTR-9999` — plain
 * lexicographic ordering would rank `MTR-9999` above `MTR-10000`. It is also why
 * the rename migrated every `SUPP-` code rather than leaving both prefixes: a
 * longer stale prefix would win this ordering forever.
 */
async function highestPartnerCode(): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<
    { code: string }[]
  >`SELECT code FROM partners ORDER BY length(code) DESC, code DESC LIMIT 1`;
  return rows[0]?.code;
}

export async function nextPartnerCode(): Promise<string> {
  const highest = await highestPartnerCode();
  return formatPartnerCode(highest ? parsePartnerCodeSequence(highest) + 1 : 1);
}

export async function createWithPartnerCode<T>(create: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextPartnerCode());
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Kode mitra gagal dibuat karena ada pendaftaran lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}
