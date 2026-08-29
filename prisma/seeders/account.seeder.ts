import { prisma } from '@/lib/prisma';
import { accountTypeFromCode } from '@/lib/account';
import { accountCodeLevel, parentAccountCode } from '@/lib/account-code';

import { ACCOUNT_SKELETON } from './data/accounts';

/**
 * Seeds the standard chart of accounts — every class, group and detail account
 * PT TAN works with (refinery, emas digital, ekspor).
 *
 * Like the country/currency seeders — and unlike the permission one — this
 * never prunes and never touches `isActive`: an account can already be
 * referenced by a posted voucher. `isTan` is written only when the row is
 * created; afterwards the flag belongs to the company. Only the display name is
 * refreshed, so a rename in the data file reaches an existing database.
 *
 * Rows are inserted parent-first: with the padded code scheme a parent's code is
 * always a prefix of its children's and never longer, so plain lexicographic
 * order is already tree pre-order. Each parent's id is remembered as it is
 * upserted, so resolving a parent costs no extra query.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedAccounts(): Promise<number> {
  const ordered = [...ACCOUNT_SKELETON].sort((a, b) => a.code.localeCompare(b.code));
  const idByCode = new Map<string, string>();

  for (const account of ordered) {
    const { code, name } = account;
    const isTan = 'isTan' in account && account.isTan === true;

    const type = accountTypeFromCode(code);
    const level = accountCodeLevel(code);
    if (!type || level === null) {
      throw new Error(`Kode akun bawaan tidak mengikuti skema: ${code}`);
    }

    const parentCode = parentAccountCode(code);
    const parentId = parentCode ? idByCode.get(parentCode) : null;

    if (parentCode && !parentId) {
      throw new Error(`Induk ${parentCode} untuk akun ${code} belum ada saat seeding.`);
    }

    const row = await prisma.ledgerAccount.upsert({
      where: { code },
      update: { name },
      create: { code, name, type, level, isTan, parentId: parentId ?? null },
      select: { id: true },
    });

    idByCode.set(code, row.id);
  }

  console.log(`Accounts: ${ordered.length} in sync`);

  return ordered.length;
}
