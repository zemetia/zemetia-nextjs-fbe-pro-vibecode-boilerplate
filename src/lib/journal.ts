import type { JournalSource, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';

/**
 * The single door into the global journal. Every ERP module — purchasing,
 * production, sales, buyback — writes its mutations through `createJournalEntry`
 * rather than touching `journal_entries`/`journal_lines` directly, so the four
 * rules below hold everywhere and can never be forgotten at one call site:
 *
 * 1. **Balanced** — `Σ debit = Σ credit`, compared in whole cents.
 * 2. **One side per line** — a line is a debit *or* a credit, never both, never neither.
 * 3. **Leaf-only** — an account that has children groups, it does not receive
 *    postings; its balance is the sum of its subtree (see `accounting.prisma`).
 * 4. **Active only** — a deactivated account is closed to new mutations while
 *    its history stays readable.
 *
 * Amounts cross this boundary as plain numbers and are converted to whole cents
 * before any comparison — summing `0.1 + 0.2` as floats would fail rule 1 for
 * reasons that have nothing to do with accounting.
 */

const CENTS = 100;

/** Rupiah → whole cents. Guards against a fraction the schema cannot store. */
function toCents(amount: number, label: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationError(`${label} harus berupa angka nol atau lebih.`);
  }

  const cents = Math.round(amount * CENTS);
  if (Math.abs(amount * CENTS - cents) > Number.EPSILON * CENTS) {
    throw new ValidationError(`${label} maksimal dua angka di belakang koma.`);
  }

  return cents;
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
}

export interface CreateJournalEntryInput {
  date: Date;
  description: string;
  source?: JournalSource;
  /** Document that caused the entry, e.g. `purchase_order` + its id. */
  referenceType?: string | null;
  referenceId?: string | null;
  /** FK ke MetalPurchase — dipakai modul pembelian, bukan `referenceType`/`referenceId`. */
  purchaseId?: string | null;
  /** FK ke MetalPurchaseDelivery (TTB). */
  deliveryId?: string | null;
  /** FK ke SalesOrder — dipakai modul penjualan. */
  salesOrderId?: string | null;
  /** FK ke SalesDelivery (surat jalan) — dipakai modul penjualan. */
  salesDeliveryId?: string | null;
  /** FK ke SalesInvoice (faktur) — dipakai modul penjualan. */
  salesInvoiceId?: string | null;
  /** FK ke CashVoucher — dipakai modul voucher, bersamaan dengan `referenceType`/`referenceId`. */
  cashVoucherId?: string | null;
  lines: JournalLineInput[];
  /** Skip the draft stage and post straight to the ledger. */
  post?: boolean;
}

const JOURNAL_ENTRY_INCLUDE = {
  lines: {
    orderBy: { lineNo: 'asc' },
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
  },
} as const;

export type JournalEntryRow = Prisma.JournalEntryGetPayload<{
  include: typeof JOURNAL_ENTRY_INCLUDE;
}>;

/**
 * Rejects every account a voucher may not touch, in one query, naming the
 * account that failed — "Akun 1110 Kas adalah akun induk…" is actionable in a
 * way "invalid account" is not.
 */
export async function assertAccountsPostable(
  accountIds: readonly string[],
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  const unique = [...new Set(accountIds)];

  const accounts = await client.ledgerAccount.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      _count: { select: { children: true } },
    },
  });

  if (accounts.length !== unique.length) {
    throw new NotFoundError('Ada akun pada jurnal ini yang sudah tidak terdaftar.');
  }

  for (const account of accounts) {
    if (account._count.children > 0) {
      throw new ValidationError(
        `Akun ${account.code} ${account.name} adalah akun induk, jadi tidak bisa menerima transaksi. Pilih salah satu akun di bawahnya.`,
      );
    }
    if (!account.isActive) {
      throw new ValidationError(
        `Akun ${account.code} ${account.name} sudah nonaktif, jadi tidak bisa dipakai untuk transaksi baru.`,
      );
    }
  }
}

interface NormalizedLine {
  lineNo: number;
  accountId: string;
  debit: number;
  credit: number;
  memo: string | null;
}

function normalizeLines(lines: readonly JournalLineInput[]): NormalizedLine[] {
  if (lines.length < 2) {
    throw new ValidationError('Jurnal harus punya minimal dua baris: satu debit dan satu kredit.');
  }

  let debitTotal = 0;
  let creditTotal = 0;

  const normalized = lines.map((line, index) => {
    const position = index + 1;
    const debit = toCents(line.debit ?? 0, `Nilai debit baris ${position}`);
    const credit = toCents(line.credit ?? 0, `Nilai kredit baris ${position}`);

    if (debit > 0 && credit > 0) {
      throw new ValidationError(
        `Baris ${position} diisi debit dan kredit sekaligus. Satu baris hanya boleh salah satu.`,
      );
    }
    if (debit === 0 && credit === 0) {
      throw new ValidationError(`Baris ${position} belum diisi nilai debit atau kreditnya.`);
    }

    debitTotal += debit;
    creditTotal += credit;

    return {
      lineNo: position,
      accountId: line.accountId,
      debit: debit / CENTS,
      credit: credit / CENTS,
      memo: line.memo ?? null,
    };
  });

  if (debitTotal !== creditTotal) {
    throw new ValidationError('Total debit dan total kredit harus sama persis.');
  }

  return normalized;
}

const NUMBER_PREFIX = 'JV';
const NUMBER_SEQUENCE_DIGITS = 4;
const MAX_NUMBER_ATTEMPTS = 5;

function numberPeriod(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * `JV-202608-0001`, restarting each month. Derived from the highest number in
 * the period rather than a sequence object, so two concurrent inserts can pick
 * the same one — `createJournalEntry` retries on the unique violation.
 */
async function nextJournalNumber(date: Date, client: Prisma.TransactionClient): Promise<string> {
  const period = numberPeriod(date);
  const latest = await client.journalEntry.findFirst({
    where: { number: { startsWith: `${NUMBER_PREFIX}-${period}-` } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const sequence = latest ? Number(latest.number.split('-').at(-1)) + 1 : 1;

  return `${NUMBER_PREFIX}-${period}-${String(sequence).padStart(NUMBER_SEQUENCE_DIGITS, '0')}`;
}

async function writeJournalEntry(
  input: CreateJournalEntryInput,
  lines: readonly NormalizedLine[],
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<JournalEntryRow> {
  await assertAccountsPostable(
    lines.map((line) => line.accountId),
    tx,
  );

  return tx.journalEntry.create({
    data: {
      number: await nextJournalNumber(input.date, tx),
      date: input.date,
      description: input.description,
      source: input.source ?? 'MANUAL',
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      purchaseId: input.purchaseId ?? null,
      deliveryId: input.deliveryId ?? null,
      cashVoucherId: input.cashVoucherId ?? null,
      status: input.post ? 'POSTED' : 'DRAFT',
      postedAt: input.post ? new Date() : null,
      postedById: input.post ? actorId : null,
      createdById: actorId,
      lines: { create: [...lines] },
    },
    include: JOURNAL_ENTRY_INCLUDE,
  });
}

export async function createJournalEntry(
  input: CreateJournalEntryInput,
  actorId: string,
): Promise<JournalEntryRow> {
  const lines = normalizeLines(input.lines);

  for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => writeJournalEntry(input, lines, actorId, tx));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new ConflictError(
    'Nomor jurnal gagal dibuat karena ada pencatatan lain di waktu yang bersamaan. Coba simpan sekali lagi.',
  );
}

/**
 * Same door, opened from inside a caller's transaction — used when a source
 * document must not exist without its journal (a voucher marked posted whose
 * entry failed to write is worse than a failed posting).
 *
 * Deliberately **without** the retry loop: inside a transaction the statement
 * that hit the unique violation has already aborted it, so retrying there can
 * only fail again (see LEARN.md, 2026-08-11). The unique index is still the last
 * word — the caller surfaces the collision and the clerk saves once more.
 */
export async function createJournalEntryWithin(
  input: CreateJournalEntryInput,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<JournalEntryRow> {
  return writeJournalEntry(input, normalizeLines(input.lines), actorId, tx);
}

/** DRAFT → POSTED. The lines become part of every balance from here on. */
export async function postJournalEntry(id: string, actorId: string): Promise<JournalEntryRow> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id },
      select: { status: true, lines: { select: { accountId: true } } },
    });
    if (!entry) throw new NotFoundError('Jurnal yang dipilih tidak ditemukan.');
    if (entry.status === 'POSTED') throw new ConflictError('Jurnal ini sudah diposting.');
    if (entry.status === 'VOID') {
      throw new ConflictError('Jurnal ini sudah dibatalkan, jadi tidak bisa diposting lagi.');
    }

    await assertAccountsPostable(
      entry.lines.map((line) => line.accountId),
      tx,
    );

    return tx.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date(), postedById: actorId },
      include: JOURNAL_ENTRY_INCLUDE,
    });
  });
}

/**
 * POSTED → VOID. The rows stay — a posted voucher is a record of what happened,
 * so it is cancelled in place rather than deleted, and stops counting toward
 * balances the moment its status changes.
 */
export async function voidJournalEntry(
  id: string,
  actorId: string,
  reason: string,
): Promise<JournalEntryRow> {
  const entry = await prisma.journalEntry.findUnique({ where: { id }, select: { status: true } });
  if (!entry) throw new NotFoundError('Jurnal yang dipilih tidak ditemukan.');
  if (entry.status === 'VOID') throw new ConflictError('Jurnal ini sudah dibatalkan.');

  return prisma.journalEntry.update({
    where: { id },
    data: { status: 'VOID', voidedAt: new Date(), voidedById: actorId, voidReason: reason },
    include: JOURNAL_ENTRY_INCLUDE,
  });
}

/**
 * Posted movement per account, plus the ids that carry any line at all — the
 * two aggregates the chart of accounts needs to show a balance and to know
 * which nodes are still free to be restructured.
 */
export async function accountMovements(): Promise<{
  movements: Map<string, { debit: number; credit: number }>;
  withMutations: Set<string>;
}> {
  const [posted, any] = await Promise.all([
    prisma.journalLine.groupBy({
      by: ['accountId'],
      where: { entry: { status: 'POSTED' } },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.groupBy({ by: ['accountId'] }),
  ]);

  return {
    movements: new Map(
      posted.map((row) => [
        row.accountId,
        { debit: Number(row._sum.debit ?? 0), credit: Number(row._sum.credit ?? 0) },
      ]),
    ),
    withMutations: new Set(any.map((row) => row.accountId)),
  };
}

/**
 * Mengganti isi sebuah jurnal draft. Barisnya **diganti seluruhnya**, bukan
 * ditambal per baris: sebuah jurnal seimbang hanya sebagai satu kesatuan, dan
 * menambal satu baris melewati satu-satunya saat yang bisa membuktikan itu.
 *
 * Dua syarat, dan keduanya diperiksa di dalam transaksi yang sama dengan
 * penulisannya: statusnya masih `DRAFT`, dan sumbernya `MANUAL`. Draft milik
 * modul lain adalah cerminan dokumennya — mengubahnya dari layar jurnal akan
 * membuat buku dan dokumen bercerita berbeda tanpa jejak mana yang benar.
 */
export async function updateJournalEntry(
  id: string,
  input: Omit<CreateJournalEntryInput, 'post' | 'source'>,
): Promise<JournalEntryRow> {
  const lines = normalizeLines(input.lines);

  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id },
      select: { status: true, source: true },
    });
    if (!entry) throw new NotFoundError('Jurnal yang dipilih tidak ditemukan.');
    if (entry.status !== 'DRAFT') {
      throw new ConflictError(
        'Jurnal ini sudah masuk buku besar, jadi isinya tidak bisa diubah lagi. Batalkan jurnalnya lalu buat penggantinya.',
      );
    }
    if (entry.source !== 'MANUAL') {
      throw new ConflictError(
        'Jurnal ini dibuat otomatis oleh dokumen sumbernya, jadi hanya bisa diubah lewat dokumen itu.',
      );
    }

    await assertAccountsPostable(
      lines.map((line) => line.accountId),
      tx,
    );

    await tx.journalLine.deleteMany({ where: { entryId: id } });

    return tx.journalEntry.update({
      where: { id },
      data: {
        date: input.date,
        description: input.description,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        lines: { create: [...lines] },
      },
      include: JOURNAL_ENTRY_INCLUDE,
    });
  });
}

/**
 * Menghapus jurnal draft manual. Yang sudah diposting tidak pernah dihapus — ia
 * dibatalkan lewat `voidJournalEntry` supaya barisnya tetap terbaca; nomor
 * jurnal yang hilang dari urutan adalah pertanyaan yang tidak punya jawaban
 * saat audit.
 *
 * `actorId` sengaja tidak diminta: baris yang dihapus tidak meninggalkan apa pun
 * untuk dilekati jejak siapa penghapusnya.
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: { status: true, source: true },
  });
  if (!entry) throw new NotFoundError('Jurnal yang dipilih tidak ditemukan.');
  if (entry.status !== 'DRAFT') {
    throw new ConflictError(
      'Jurnal yang sudah masuk buku besar tidak bisa dihapus. Batalkan jurnalnya — barisnya tetap tersimpan sebagai catatan.',
    );
  }
  if (entry.source !== 'MANUAL') {
    throw new ConflictError(
      'Jurnal ini dibuat otomatis oleh dokumen sumbernya, jadi hanya bisa dihapus lewat dokumen itu.',
    );
  }

  await prisma.journalEntry.delete({ where: { id } });
}
