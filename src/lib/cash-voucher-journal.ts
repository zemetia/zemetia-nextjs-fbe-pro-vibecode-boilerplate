import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { createJournalEntryWithin } from '@/lib/journal';
import {
  buildVoucherJournalLines,
  VOUCHER_KIND_LABELS,
  VOUCHER_REFERENCE_TYPE,
  voucherKind,
} from '@/lib/cash-voucher';
import type { VoucherJournalRef } from '@/lib/cash-voucher-dto';

/**
 * The bridge from a voucher to the ledger.
 *
 * The voucher never writes `journal_entries` itself: it hands its rows to
 * `src/lib/journal.ts`, which is the only place the four ledger rules live, and
 * the side each row lands on comes from `buildVoucherJournalLines()` — pure, so
 * the rule can be tested without a database.
 *
 * What lives here is only the part that needs one: reading the document, and
 * writing both sides inside the caller's transaction.
 */

const VOUCHER_WITH_LINES = {
  funds: {
    orderBy: { lineNo: 'asc' },
    select: { accountId: true, amount: true, note: true },
  },
  lines: {
    orderBy: { lineNo: 'asc' },
    select: { accountId: true, amount: true, description: true },
  },
} as const;

/**
 * Writes the voucher's entry straight to POSTED, inside the caller's transaction
 * — a voucher marked posted whose journal failed to write would be a lie the
 * ledger has no way to notice.
 */
export async function postVoucherJournal(
  voucherId: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<VoucherJournalRef> {
  const voucher = await tx.cashVoucher.findUnique({
    where: { id: voucherId },
    include: VOUCHER_WITH_LINES,
  });

  if (!voucher) throw new NotFoundError('Voucher yang dipilih tidak ditemukan.');

  const kind = voucherKind(voucher.fund, voucher.direction);

  const entry = await createJournalEntryWithin(
    {
      date: voucher.date,
      description: `${VOUCHER_KIND_LABELS[kind]} ${voucher.number} — ${voucher.purpose}`,
      source: 'PAYMENT',
      referenceType: VOUCHER_REFERENCE_TYPE,
      referenceId: voucher.id,
      post: true,
      lines: buildVoucherJournalLines(
        voucher.direction,
        voucher.funds.map((fund) => ({
          accountId: fund.accountId,
          amount: Number(fund.amount),
          memo: fund.note,
        })),
        voucher.lines.map((line) => ({
          accountId: line.accountId,
          amount: Number(line.amount),
          memo: line.description,
        })),
      ),
    },
    actorId,
    tx,
  );

  return { id: entry.id, number: entry.number, status: entry.status };
}

/** The entry this voucher produced, if it ever reached the ledger. */
export async function findVoucherJournal(voucherId: string): Promise<VoucherJournalRef | null> {
  const entry = await prisma.journalEntry.findFirst({
    where: { referenceType: VOUCHER_REFERENCE_TYPE, referenceId: voucherId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, status: true },
  });

  return entry ?? null;
}

/**
 * Cancelling a voucher cancels its entry in the same breath. The rows stay on
 * both sides — a posted document is a record of what happened, so it stops
 * counting toward balances by changing status, never by being deleted.
 */
export async function voidVoucherJournal(
  voucherId: string,
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.journalEntry.updateMany({
    where: {
      referenceType: VOUCHER_REFERENCE_TYPE,
      referenceId: voucherId,
      status: { not: 'VOID' },
    },
    data: { status: 'VOID', voidedAt: new Date(), voidedById: actorId, voidReason: reason },
  });
}
