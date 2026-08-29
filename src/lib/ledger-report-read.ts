import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { fromUtcDateOnly, toUtcDateOnly } from '@/lib/date';
import { normalBalanceForType } from '@/lib/account';
import {
  addSides,
  isBalanced,
  money,
  movementBalance,
  NO_SIDES,
  runningBalances,
  sidesForType,
  type Movement,
  type SideAmounts,
} from '@/lib/ledger-report';
import type { GeneralLedgerQuery, TrialBalanceQuery } from '@/lib/validations';
import type {
  GeneralLedgerDTO,
  GeneralLedgerRowDTO,
  LedgerAccountRefDTO,
  TrialBalanceDTO,
  TrialBalanceRowDTO,
} from '@/types/dtos';

/**
 * Pembaca buku besar dan neraca saldo.
 *
 * Tiga aturan mengikat keduanya:
 *
 * 1. **Hanya jurnal `POSTED`.** Draft belum disepakati siapa pun dan yang batal
 *    sudah tidak berlaku. Keduanya tidak pernah ikut saldo.
 * 2. **Saldo awal datang dari sebelum periodenya**, bukan dari nol. Laporan yang
 *    memulai dari nol tiap kali periodenya digeser melaporkan saldo kas berubah
 *    karena filternya berubah.
 * 3. **Hanya akun daun.** Akun induk tidak pernah menerima jurnal (`journal.ts`),
 *    jadi saldonya adalah jumlah anaknya dan memunculkannya di neraca saldo akan
 *    menghitung angka yang sama dua kali.
 */

const POSTED: Prisma.JournalEntryWhereInput = { status: 'POSTED' };

/** Baris jurnal milik periode, atau milik seluruh waktu saat periodenya kosong. */
function entryWithin(from?: string, to?: string): Prisma.JournalEntryWhereInput {
  return {
    ...POSTED,
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: toUtcDateOnly(from) } : {}),
            ...(to ? { lte: toUtcDateOnly(to) } : {}),
          },
        }
      : {}),
  };
}

/** Baris jurnal sebelum periode dimulai — dari mana saldo awal berasal. */
function entryBefore(from?: string): Prisma.JournalEntryWhereInput | null {
  return from ? { ...POSTED, date: { lt: toUtcDateOnly(from) } } : null;
}

function toNumber(value: Prisma.Decimal | null): number {
  return money(Number(value ?? 0));
}

function toAccountRef(account: {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountRefDTO['type'];
}): LedgerAccountRefDTO {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    normal_balance: normalBalanceForType(account.type),
  };
}

// ─── Buku besar ──────────────────────────────────────────────────────────────

const LEDGER_ROW_INCLUDE = {
  entry: { select: { id: true, number: true, date: true, description: true, source: true } },
} as const;

/**
 * Urutan buku besar, dan ia bagian dari kebenaran laporannya.
 *
 * Saldo berjalan hanya punya arti kalau barisnya menaik menurut waktu. Nomor
 * jurnal ikut sebagai pemutus untuk dua transaksi bertanggal sama, dan nomor
 * baris memutus di dalam satu jurnal — dengan begitu urutannya tetap sama di
 * setiap pemanggilan, dan halaman 2 tidak pernah mengulang baris halaman 1.
 */
const LEDGER_ORDER = [
  { entry: { date: 'asc' } },
  { entry: { number: 'asc' } },
  { lineNo: 'asc' },
] satisfies Prisma.JournalLineOrderByWithRelationInput[];

async function movementOf(where: Prisma.JournalLineWhereInput): Promise<Movement> {
  const sum = await prisma.journalLine.aggregate({ where, _sum: { debit: true, credit: true } });

  return { debit: toNumber(sum._sum.debit), credit: toNumber(sum._sum.credit) };
}

/**
 * Saldo tepat sebelum baris pertama sebuah halaman.
 *
 * Halaman 5 buku besar tidak boleh memulai saldonya dari saldo awal periode —
 * yang benar adalah saldo awal ditambah seluruh baris yang mendahuluinya. Baris
 * itu diambil dalam urutan yang sama persis dengan urutan laporannya, karena
 * "yang mendahului" tidak punya arti lain.
 */
async function balanceBeforePage(
  where: Prisma.JournalLineWhereInput,
  type: LedgerAccountRefDTO['type'],
  opening: number,
  skip: number,
): Promise<number> {
  if (skip === 0) return opening;

  const preceding = await prisma.journalLine.findMany({
    where,
    orderBy: LEDGER_ORDER,
    take: skip,
    select: { debit: true, credit: true },
  });

  const movement = preceding.reduce<Movement>(
    (total, line) => ({
      debit: money(total.debit + toNumber(line.debit)),
      credit: money(total.credit + toNumber(line.credit)),
    }),
    { debit: 0, credit: 0 },
  );

  return money(opening + movementBalance(type, movement));
}

export async function loadGeneralLedger(
  query: GeneralLedgerQuery,
  skip: number,
  take: number,
): Promise<GeneralLedgerDTO> {
  const account = await prisma.ledgerAccount.findUnique({
    where: { id: query.account_id },
    select: { id: true, code: true, name: true, type: true },
  });

  if (!account) throw new NotFoundError('Akun yang dipilih tidak ada di bagan akun.');

  const periodWhere: Prisma.JournalLineWhereInput = {
    accountId: account.id,
    entry: entryWithin(query.date_from, query.date_to),
  };

  const before = entryBefore(query.date_from);

  const [openingMovement, periodMovement, total] = await Promise.all([
    before ? movementOf({ accountId: account.id, entry: before }) : { debit: 0, credit: 0 },
    movementOf(periodWhere),
    prisma.journalLine.count({ where: periodWhere }),
  ]);

  const opening = movementBalance(account.type, openingMovement);

  const [lines, pageOpening] = await Promise.all([
    prisma.journalLine.findMany({
      where: periodWhere,
      orderBy: LEDGER_ORDER,
      skip,
      take,
      include: LEDGER_ROW_INCLUDE,
    }),
    balanceBeforePage(periodWhere, account.type, opening, skip),
  ]);

  const balances = runningBalances(
    account.type,
    pageOpening,
    lines.map((line) => ({ debit: toNumber(line.debit), credit: toNumber(line.credit) })),
  );

  const rows: GeneralLedgerRowDTO[] = lines.map((line, index) => ({
    line_id: line.id,
    entry_id: line.entry.id,
    number: line.entry.number,
    date: fromUtcDateOnly(line.entry.date),
    description: line.entry.description,
    source: line.entry.source,
    memo: line.memo,
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
    running_balance: balances[index] ?? pageOpening,
  }));

  return {
    account: toAccountRef(account),
    opening_balance: opening,
    page_opening_balance: pageOpening,
    rows,
    period: { debit: periodMovement.debit, credit: periodMovement.credit },
    closing_balance: money(opening + movementBalance(account.type, periodMovement)),
    total,
    page: query.page,
    page_size: query.limit,
    total_pages: Math.ceil(total / query.limit),
  };
}

// ─── Neraca saldo ────────────────────────────────────────────────────────────

/**
 * Mutasi per akun untuk satu rentang, sebagai peta. Satu `groupBy` untuk seluruh
 * bagan akun — menanyakan saldo per akun satu per satu adalah 200 kueri untuk
 * satu layar.
 */
async function movementsByAccount(
  entry: Prisma.JournalEntryWhereInput,
): Promise<Map<string, Movement>> {
  const rows = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { entry },
    _sum: { debit: true, credit: true },
  });

  return new Map(
    rows.map((row) => [
      row.accountId,
      { debit: toNumber(row._sum.debit), credit: toNumber(row._sum.credit) },
    ]),
  );
}

export async function loadTrialBalance(query: TrialBalanceQuery): Promise<TrialBalanceDTO> {
  const before = entryBefore(query.date_from);

  const [accounts, openings, periods] = await Promise.all([
    // Akun daun saja. Akun induk tidak pernah menerima jurnal, jadi
    // memunculkannya akan menghitung saldo anaknya dua kali.
    prisma.ledgerAccount.findMany({
      where: { children: { none: {} } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
    before ? movementsByAccount(before) : new Map<string, Movement>(),
    movementsByAccount(entryWithin(query.date_from, query.date_to)),
  ]);

  const includeEmpty = query.include_empty === 'true';

  const rows: TrialBalanceRowDTO[] = [];
  let totals = { opening: NO_SIDES, period: NO_SIDES, closing: NO_SIDES };

  for (const account of accounts) {
    const openingMovement = openings.get(account.id);
    const periodMovement = periods.get(account.id);

    const opening = openingMovement ? movementBalance(account.type, openingMovement) : 0;
    const period: SideAmounts = {
      debit: periodMovement?.debit ?? 0,
      credit: periodMovement?.credit ?? 0,
    };
    const closing = money(opening + movementBalance(account.type, period));

    const isEmpty = opening === 0 && period.debit === 0 && period.credit === 0;
    if (isEmpty && !includeEmpty) continue;

    const row: TrialBalanceRowDTO = {
      account: toAccountRef(account),
      opening: sidesForType(opening, account.type),
      period,
      closing: sidesForType(closing, account.type),
    };

    rows.push(row);

    // Total dijumlahkan atas baris yang benar-benar masuk laporan, bukan atas
    // seluruh akun — angka di kaki tabel harus menjumlahkan persis yang tampil
    // di atasnya.
    totals = {
      opening: addSides(totals.opening, row.opening),
      period: addSides(totals.period, row.period),
      closing: addSides(totals.closing, row.closing),
    };
  }

  return {
    rows,
    totals: {
      ...totals,
      is_balanced:
        isBalanced(totals.opening) && isBalanced(totals.period) && isBalanced(totals.closing),
    },
    account_count: rows.length,
  };
}
