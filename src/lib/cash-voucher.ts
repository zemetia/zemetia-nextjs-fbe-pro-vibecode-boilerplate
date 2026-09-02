import { roundTo } from '@/lib/number';
import type {
  VoucherCategory,
  VoucherDirection,
  VoucherFund,
  VoucherKind,
  VoucherPaymentMethod,
  VoucherStatus,
  VoucherTransferChannel,
} from '@/types/value-objects';

/**
 * Presentation labels and the arithmetic of a finance voucher. Everything here
 * is pure and isomorphic: the form previews the total with the exact function the
 * route handler stores from, so what the clerk approves before saving and what
 * the document is worth afterwards can never disagree.
 *
 * This is also where the *rules between the two axes* live — which payment method
 * belongs to which fund, and which method needs a clearing date. They are stated
 * once here, consumed by Zod and by the form, so a method added later cannot be
 * accepted by the API while staying invisible on screen.
 */

export const VOUCHER_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'POSTED',
  'VOID',
] as const;

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Menunggu Verifikasi',
  APPROVED: 'Disetujui',
  POSTED: 'Diposting',
  VOID: 'Dibatalkan',
};

export const VOUCHER_STATUS_OPTIONS = VOUCHER_STATUSES.map((value) => ({
  value,
  label: VOUCHER_STATUS_LABELS[value],
}));

export const VOUCHER_FUNDS = ['CASH', 'BANK', 'MEMORIAL'] as const;

export const VOUCHER_FUND_LABELS: Record<VoucherFund, string> = {
  CASH: 'Kas',
  BANK: 'Bank',
  MEMORIAL: 'Memorial',
};

export const VOUCHER_FUND_OPTIONS = VOUCHER_FUNDS.map((value) => ({
  value,
  label: VOUCHER_FUND_LABELS[value],
}));

export const VOUCHER_DIRECTIONS = ['IN', 'OUT'] as const;

export const VOUCHER_DIRECTION_LABELS: Record<VoucherDirection, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
};

export const VOUCHER_DIRECTION_OPTIONS = VOUCHER_DIRECTIONS.map((value) => ({
  value,
  label: VOUCHER_DIRECTION_LABELS[value],
}));

export const VOUCHER_CATEGORIES = [
  'GENERAL_EXPENSE',
  'EMPLOYEE',
  'SUPPLIER',
  'PO_PRINCIPAL',
  'CUSTOMS_DUTY_PPH22',
  'LOGISTICS_HANDLING',
  'OTHER_EXPENSE',
] as const;

export const VOUCHER_CATEGORY_LABELS: Record<VoucherCategory, string> = {
  GENERAL_EXPENSE: 'Biaya Umum',
  EMPLOYEE: 'Karyawan',
  SUPPLIER: 'Supplier',
  PO_PRINCIPAL: 'Pokok Supplier / PO',
  CUSTOMS_DUTY_PPH22: 'PPh 22',
  LOGISTICS_HANDLING: 'Logistik & Penanganan',
  OTHER_EXPENSE: 'Biaya Tambahan',
};

export const VOUCHER_CATEGORY_OPTIONS = VOUCHER_CATEGORIES.map((value) => ({
  value,
  label: VOUCHER_CATEGORY_LABELS[value],
}));

export const VOUCHER_PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'GIRO',
  'CARD',
  'VIRTUAL_ACCOUNT',
  'LETTER_OF_CREDIT',
  'ESCROW',
  'GOLD',
  'NETTING',
] as const;

export const VOUCHER_PAYMENT_METHOD_LABELS: Record<VoucherPaymentMethod, string> = {
  CASH: 'Tunai',
  BANK_TRANSFER: 'Transfer Bank',
  CHEQUE: 'Cek',
  GIRO: 'Bilyet Giro',
  CARD: 'Kartu Debit/Kredit',
  VIRTUAL_ACCOUNT: 'Virtual Account',
  LETTER_OF_CREDIT: 'L/C — SKBDN',
  ESCROW: 'Escrow',
  GOLD: 'Emas Fisik',
  NETTING: 'Kompensasi',
};

/** One-line hint under each card — what the method is *for*, not what it is. */
export const VOUCHER_PAYMENT_METHOD_HINTS: Record<VoucherPaymentMethod, string> = {
  CASH: 'Uang tunai langsung',
  BANK_TRANSFER: 'BI-FAST, SKN, atau RTGS',
  CHEQUE: 'Cair saat dicairkan penerima',
  GIRO: 'Cair pada tanggal efektif',
  CARD: 'Lewat mesin EDC atau online',
  VIRTUAL_ACCOUNT: 'Nomor VA khusus penerima',
  LETTER_OF_CREDIT: 'Dijamin bank pembuka',
  ESCROW: 'Ditahan rekening pihak ketiga',
  GOLD: 'Diselesaikan dengan emas',
  NETTING: 'Saling hapus utang-piutang',
};

/**
 * Which fund each method may settle through — the rule that keeps a cash balance
 * honest.
 *
 * Gold and netting move no money at all, so they are memorial only: booking them
 * against cash would report a cash balance that never happened, and nothing on
 * screen would look wrong. Everything routed through a bank instrument is bank
 * only, for the mirror-image reason.
 */
export const PAYMENT_METHOD_FUND: Record<VoucherPaymentMethod, VoucherFund> = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK',
  CHEQUE: 'BANK',
  GIRO: 'BANK',
  CARD: 'BANK',
  VIRTUAL_ACCOUNT: 'BANK',
  LETTER_OF_CREDIT: 'BANK',
  ESCROW: 'BANK',
  GOLD: 'MEMORIAL',
  NETTING: 'MEMORIAL',
};

export function paymentMethodsForFund(fund: VoucherFund): VoucherPaymentMethod[] {
  return VOUCHER_PAYMENT_METHODS.filter((method) => PAYMENT_METHOD_FUND[method] === fund);
}

export function isPaymentMethodAllowed(method: VoucherPaymentMethod, fund: VoucherFund): boolean {
  return PAYMENT_METHOD_FUND[method] === fund;
}

/**
 * The fund a method implies — the form flips the voucher type from the card the
 * clerk picked, so an impossible pair is never on screen to be validated later.
 */
export function fundForPaymentMethod(method: VoucherPaymentMethod): VoucherFund {
  return PAYMENT_METHOD_FUND[method];
}

/**
 * Instruments that only settle later. Their due date is required: a cheque or a
 * bilyet giro without one can neither be chased nor reconciled, and the voucher
 * that issued it is the last place the date is still known.
 */
export const METHODS_REQUIRING_DUE_DATE: readonly VoucherPaymentMethod[] = ['CHEQUE', 'GIRO'];

export function requiresDueDate(method: VoucherPaymentMethod): boolean {
  return METHODS_REQUIRING_DUE_DATE.includes(method);
}

export function requiresTransferChannel(method: VoucherPaymentMethod): boolean {
  return method === 'BANK_TRANSFER';
}

/**
 * Payment stage validation rules for the purchase flow.
 *
 * PRE_RECEIPT means the money is a down payment before goods enter the vault, so
 * it must point at the purchase order and cannot point at a GoodsReceipt.
 * POST_RECEIPT means the payment happens after receipt or is settling a confirmed
 * purchase; at least one real document target must exist, and a delivery may be
 * present when the post-receipt settlement references the receipt.
 */
export function validateVoucherPaymentStage(
  stage: 'PRE_RECEIPT' | 'POST_RECEIPT' | 'OTHER',
  purchaseId: string | null,
  deliveryId: string | null,
): void {
  if (stage === 'PRE_RECEIPT') {
    if (!purchaseId) {
      throw new Error('Pembayaran uang muka sebelum TTB harus menunjuk PurchaseOrder.');
    }

    if (deliveryId) {
      throw new Error('Pembayaran uang muka sebelum TTB tidak boleh menunjuk GoodsReceipt.');
    }

    return;
  }

  if (stage === 'POST_RECEIPT') {
    if (!purchaseId && !deliveryId) {
      throw new Error('Pembayaran setelah TTB harus menunjuk PurchaseOrder atau GoodsReceipt.');
    }

    return;
  }
}

export const VOUCHER_TRANSFER_CHANNELS = ['BI_FAST', 'SKN', 'RTGS'] as const;

export const VOUCHER_TRANSFER_CHANNEL_LABELS: Record<VoucherTransferChannel, string> = {
  BI_FAST: 'BI-FAST',
  SKN: 'SKN (Kliring)',
  RTGS: 'RTGS',
};

export const VOUCHER_TRANSFER_CHANNEL_OPTIONS = VOUCHER_TRANSFER_CHANNELS.map((value) => ({
  value,
  label: VOUCHER_TRANSFER_CHANNEL_LABELS[value],
}));

/**
 * The field abbreviation, derived from `fund × direction` rather than stored.
 * Two columns already answer it; a third would be a second answer free to drift.
 *
 * Memorial collapses to one code in both directions — that is how the paperwork
 * is actually filed, and the direction is still on the document.
 */
export function voucherKind(fund: VoucherFund, direction: VoucherDirection): VoucherKind {
  if (fund === 'MEMORIAL') return 'BM';
  if (fund === 'CASH') return direction === 'IN' ? 'BKM' : 'BKK';
  return direction === 'IN' ? 'BBM' : 'BBK';
}

export const VOUCHER_KIND_LABELS: Record<VoucherKind, string> = {
  BKM: 'Bukti Kas Masuk',
  BKK: 'Bukti Kas Keluar',
  BBM: 'Bukti Bank Masuk',
  BBK: 'Bukti Bank Keluar',
  BM: 'Bukti Memorial',
};

/** `BKK` — the number prefix is the kind itself, so a number reads as its type. */
export function voucherNumberPrefix(fund: VoucherFund, direction: VoucherDirection): string {
  return voucherKind(fund, direction);
}

/** "Pay to" when money leaves, "Receive from" when it arrives. */
export function counterpartyLabel(direction: VoucherDirection): string {
  return direction === 'OUT' ? 'Dibayarkan kepada' : 'Diterima dari';
}

export const MONEY_SCALE = 2;

export interface VoucherLineInput {
  amount: number;
}

/**
 * The voucher's only money column, summed from its rows.
 *
 * Each row is rounded to the stored scale *before* the sum, so the total always
 * equals the figures printed next to it — summing the unrounded values produces
 * a total the clerk cannot reproduce by adding up the page.
 */
export function sumVoucherLines(lines: readonly VoucherLineInput[]): number {
  return roundTo(
    lines.reduce((total, line) => total + roundTo(line.amount, MONEY_SCALE), 0),
    MONEY_SCALE,
  );
}

export interface VoucherJournalLine {
  accountId: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
}

interface VoucherLineForJournal {
  accountId: string;
  amount: number;
  memo: string | null;
}

/**
 * Which side of the ledger each row lands on — the one thing the journal itself
 * cannot know, and the reason the form has no debit/credit picker.
 *
 * OUT — the detail accounts are debited (an expense, a payable settled) and the
 *       cash/bank accounts are credited.
 * IN  — the mirror image: cash/bank debited, detail accounts credited.
 *
 * **Both sides are lists.** The fund side used to be one account and one total,
 * which is right until a single payment leaves two bank accounts on the same day
 * — a document that could be agreed once but never recorded once. With both sides
 * as rows, balance is a consequence of the shape (Σ fund = Σ detail, enforced by
 * Zod before either list reaches here) rather than something kept in step by hand.
 *
 * Pure, so the rule is testable without a database; the server wrapper in
 * `cash-voucher-journal.ts` only feeds it rows it has read.
 */
export function buildVoucherJournalLines(
  direction: VoucherDirection,
  funds: readonly VoucherLineForJournal[],
  lines: readonly VoucherLineForJournal[],
): VoucherJournalLine[] {
  const detail = lines.map((line) => ({
    accountId: line.accountId,
    ...(direction === 'OUT' ? { debit: line.amount } : { credit: line.amount }),
    memo: line.memo,
  }));

  const contra = funds.map((fund) => ({
    accountId: fund.accountId,
    ...(direction === 'OUT' ? { credit: fund.amount } : { debit: fund.amount }),
    memo: fund.memo,
  }));

  return direction === 'OUT' ? [...detail, ...contra] : [...contra, ...detail];
}

/** Only a draft may be edited or deleted; everything else is corrected by voiding. */
export function isVoucherEditable(status: VoucherStatus): boolean {
  return status === 'DRAFT';
}

/** A voucher that has reached the ledger — or is about to — is cancelled, not deleted. */
export function isVoucherVoidable(status: VoucherStatus): boolean {
  return status === 'APPROVED' || status === 'POSTED';
}

/** What `referenceType` the journal entry carries back to this document. */
export const VOUCHER_REFERENCE_TYPE = 'cash_voucher';
