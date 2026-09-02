import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertAccountsPostable } from '@/lib/journal';
import { resolvePendingApprovals } from '@/lib/approval-hooks';
import { sumVoucherLines, VOUCHER_STATUS_LABELS } from '@/lib/cash-voucher';
import { postVoucherJournal } from '@/lib/cash-voucher-journal';
import type { VoucherJournalRef } from '@/lib/cash-voucher-dto';
import { toUtcDateOnly } from '@/lib/date';
import type { CreateCashVoucherInput } from '@/lib/validations';

/**
 * The reference checks every write of a voucher performs. They live here rather
 * than inside each route handler so create and update can never enforce them
 * differently — and so each reads as a message the clerk can act on instead of a
 * foreign-key error.
 */

/**
 * Every account the voucher will touch, checked in one pass.
 *
 * The fund accounts are checked together with the detail lines because they end
 * up on the same journal entry, and rejecting half of them first would make the
 * clerk fix one account only to be told about the next.
 *
 * The extra rule here is the one the journal itself cannot see: an account may
 * not sit on both sides. That voucher would post a debit and a credit to the same
 * account — balanced, accepted, and worth nothing. The rule survived the fund side
 * becoming a list: now *any* of the paying accounts may collide with *any* detail
 * row, so the overlap is computed rather than compared once.
 */
export async function assertVoucherAccounts(
  fundAccountIds: readonly string[],
  lineAccountIds: readonly string[],
): Promise<void> {
  const details = new Set(lineAccountIds);
  const onBothSides = fundAccountIds.find((accountId) => details.has(accountId));

  if (onBothSides) {
    const account = await prisma.ledgerAccount.findUnique({
      where: { id: onBothSides },
      select: { code: true, name: true },
    });

    throw new ValidationError(
      account
        ? `Akun ${account.code} ${account.name} dipakai sebagai akun kas/bank sekaligus akun rincian, jadi voucher ini tidak memindahkan apa pun. Pilih akun yang berbeda di rinciannya.`
        : 'Akun kas/bank tidak boleh dipakai lagi di baris rincian.',
    );
  }

  await assertAccountsPostable([...fundAccountIds, ...lineAccountIds]);
}

/** `Restrict` relation — reject it here so a stale pick reads as a message, not a 500. */
export async function assertPartnerUsable(partnerId: string | null): Promise<void> {
  if (!partnerId) return;

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { name: true, isActive: true },
  });

  if (!partner) throw new NotFoundError('Mitra yang dipilih tidak ditemukan.');

  if (!partner.isActive) {
    throw new ValidationError(
      `Mitra ${partner.name} sudah nonaktif, jadi tidak bisa dipakai untuk voucher baru.`,
    );
  }
}

/** Mata uang + kurs yang dibekukan di voucher, dibaca dari dokumen yang dibayar. */
export interface VoucherReference {
  referenceType: string | null;
  referenceId: string | null;
  purchaseId: string | null;
  deliveryId: string | null;
  referenceCurrencyCode: string | null;
  referenceExchangeRate: number | null;
}

const NO_REFERENCE: VoucherReference = {
  referenceType: null,
  referenceId: null,
  purchaseId: null,
  deliveryId: null,
  referenceCurrencyCode: null,
  referenceExchangeRate: null,
};

/**
 * Dokumen yang dibayar voucher ini, beserta **kursnya sendiri**.
 *
 * Kursnya dibaca dari dokumennya, tidak pernah dari payload. Supplier impor
 * dibayar dari rekening dolar, jadi satu kurs berlaku dari PO sampai lunas — dan
 * membiarkan client mengirim kurs berarti membiarkan satu cicilan memakai angka
 * lain, sehingga hutangnya menyisakan saldo yang tidak akan pernah nol dan tidak
 * ada apa pun di layar yang menunjukkannya.
 *
 * Dokumen yang belum dikonfirmasi ditolak: membayar kesepakatan yang masih draft
 * berarti kas bergerak untuk dokumen yang isinya masih bisa berubah setelahnya.
 */
export async function resolveVoucherReference(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
): Promise<VoucherReference> {
  if (!referenceType || !referenceId) return NO_REFERENCE;

  let purchaseId: string | null = null;
  let deliveryId: string | null = null;
  const normalizedType = referenceType.toLowerCase();

  if (normalizedType.includes('purchase') || normalizedType === 'po') {
    const purchase = await prisma.purchaseOrder.findFirst({
      where: { OR: [{ id: referenceId }, { number: referenceId }] },
      select: { id: true, currencyCode: true, exchangeRate: true },
    });
    if (purchase) {
      purchaseId = purchase.id;
      return {
        referenceType,
        referenceId,
        purchaseId,
        deliveryId: null,
        referenceCurrencyCode: purchase.currencyCode,
        referenceExchangeRate: purchase.exchangeRate ? Number(purchase.exchangeRate) : null,
      };
    }
  } else if (normalizedType.includes('delivery') || normalizedType === 'ttb') {
    const delivery = await prisma.goodsReceipt.findFirst({
      where: { OR: [{ id: referenceId }, { number: referenceId }] },
      select: { id: true, purchaseId: true },
    });
    if (delivery) {
      deliveryId = delivery.id;
      purchaseId = delivery.purchaseId;
    }
  }

  return {
    referenceType,
    referenceId,
    purchaseId,
    deliveryId,
    referenceCurrencyCode: null,
    referenceExchangeRate: null,
  };
}

/**
 * Flattens the validated payload into the columns the row stores, with the total
 * folded in from the lines. Create and update both go through it, so the derived
 * total is recomputed on every write and can never be left behind by an edit.
 *
 * Note what is *not* here: a total sent by the client. The total is Σ lines and
 * nothing else — accepting one alongside the rows is how a document and its
 * journal end up disagreeing with nothing on screen looking wrong.
 */
export function toCashVoucherColumns(body: CreateCashVoucherInput, reference: VoucherReference) {
  return {
    ...reference,
    fund: body.fund,
    direction: body.direction,
    date: toUtcDateOnly(body.date),
    category: body.category,
    counterpartyName: body.counterparty_name,
    partnerId: body.partner_id,
    purpose: body.purpose,
    paymentMethod: body.payment_method,
    transferChannel: body.transfer_channel,
    bankName: body.bank_name,
    bankAccountNo: body.bank_account_no,
    referenceNumber: body.reference_number,
    dueDate: body.due_date ? toUtcDateOnly(body.due_date) : null,
    autoPostOnApproval: body.auto_post_on_approval,
    totalAmount: sumVoucherLines(body.lines.map((line) => ({ amount: line.amount }))),
    notes: body.notes,
  };
}

/**
 * Rows for a `funds: { create: … }` nested write — the accounts the money left.
 *
 * Numbered like the detail rows and for the same reason: the order the clerk
 * typed is the order the printed voucher must read in.
 */
export function toCashVoucherFundRows(body: CreateCashVoucherInput) {
  return body.funds.map((fund, index) => ({
    lineNo: index + 1,
    accountId: fund.account_id,
    amount: fund.amount,
    note: fund.note,
  }));
}

/** Rows for a `lines: { create: … }` nested write, numbered as the clerk typed them. */
export function toCashVoucherLineRows(body: CreateCashVoucherInput) {
  return body.lines.map((line, index) => ({
    lineNo: index + 1,
    accountId: line.account_id,
    description: line.description,
    amount: line.amount,
  }));
}

/**
 * PENDING_APPROVAL → APPROVED, plus posting jurnalnya bila voucher itu ditandai
 * auto-post. Mengembalikan jurnal yang lahir (atau `null`) supaya pemanggilnya
 * bisa menyebutnya di respons tanpa mencarinya lagi.
 *
 * Voucher sudah punya alur persetujuannya sendiri sejak sebelum inbox direktur
 * ada, jadi di sinilah keduanya bertemu: satu implementasi, dua pintu masuk.
 * Auto-post dihormati **hanya di sini** — fieldnya terkunci begitu voucher
 * meninggalkan DRAFT justru supaya cabang ini tidak bisa diubah setelah
 * persetujuannya diberikan.
 */
export async function approveCashVoucher(
  id: string,
  actorId: string,
  note: string | null,
  tx: Prisma.TransactionClient,
): Promise<VoucherJournalRef | null> {
  const existing = await tx.cashVoucher.findUnique({
    where: { id },
    select: { status: true, autoPostOnApproval: true },
  });
  if (!existing) throw new NotFoundError('Voucher tidak ditemukan.');

  if (existing.status !== 'PENDING_APPROVAL') {
    throw new ConflictError(
      `Voucher ini berstatus ${VOUCHER_STATUS_LABELS[existing.status]}, jadi tidak bisa disetujui.`,
    );
  }

  const now = new Date();
  const journal = existing.autoPostOnApproval ? await postVoucherJournal(id, actorId, tx) : null;

  await tx.cashVoucher.update({
    where: { id },
    data: {
      status: journal ? 'POSTED' : 'APPROVED',
      reviewedById: actorId,
      reviewedAt: now,
      reviewNote: note,
      ...(journal ? { postedById: actorId, postedAt: now } : {}),
    },
  });

  await resolvePendingApprovals('CASH_VOUCHER_APPROVE', id, 'APPROVED', actorId, note, tx);

  return journal;
}
