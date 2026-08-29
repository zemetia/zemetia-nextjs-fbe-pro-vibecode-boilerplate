import { fromDateOnly, toDateOnly, today } from '@/lib/date';
import {
  fundForPaymentMethod,
  requiresDueDate,
  requiresTransferChannel,
  sumVoucherLines,
} from '@/lib/cash-voucher';
import type { CashVoucherWritePayload } from '@/services';
import type {
  CashVoucherDetailVO,
  VoucherCategory,
  VoucherDirection,
  VoucherFund,
  VoucherPaymentMethod,
  VoucherTransferChannel,
} from '@/types/value-objects';

/**
 * Form state for the voucher form.
 *
 * Numbers are `number | undefined` (never `0`) so `<NumberInput />` renders an
 * empty field instead of a zero the user has to delete first.
 */

export interface VoucherLineState {
  /** Client-side row identity. Never sent — the API numbers the rows itself. */
  key: string;
  accountId: string;
  description: string;
  amount: number | undefined;
}

/** One paying account. Same shape as a detail row — the sides are symmetrical now. */
export interface VoucherFundState {
  key: string;
  accountId: string;
  amount: number | undefined;
  note: string;
}

export interface VoucherFormState {
  /**
   * `fund` is **not asked directly**. The payment method already answers it —
   * cash is cash, a bilyet giro is a bank instrument, gold is neither — so the
   * card the clerk picks sets it, and an impossible pair never reaches the screen
   * to be validated afterwards.
   */
  fund: VoucherFund;
  direction: VoucherDirection;
  date: Date | undefined;
  category: VoucherCategory;
  counterpartyName: string;
  partnerId: string;
  purpose: string;
  funds: VoucherFundState[];
  paymentMethod: VoucherPaymentMethod;
  transferChannel: VoucherTransferChannel | undefined;
  bankName: string;
  bankAccountNo: string;
  referenceNumber: string;
  dueDate: Date | undefined;
  autoPostOnApproval: boolean;
  lines: VoucherLineState[];
  notes: string;
}

let lineCounter = 0;

/** Row keys only have to be unique within one mounted form. */
export function newLine(): VoucherLineState {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, accountId: '', description: '', amount: undefined };
}

export function newFund(): VoucherFundState {
  lineCounter += 1;
  return { key: `fund-${lineCounter}`, accountId: '', amount: undefined, note: '' };
}

export function emptyForm(direction: VoucherDirection = 'OUT'): VoucherFormState {
  return {
    fund: 'CASH',
    direction,
    date: today(),
    category: 'GENERAL_EXPENSE',
    counterpartyName: '',
    partnerId: '',
    purpose: '',
    funds: [newFund()],
    paymentMethod: 'CASH',
    transferChannel: undefined,
    bankName: '',
    bankAccountNo: '',
    referenceNumber: '',
    dueDate: undefined,
    autoPostOnApproval: true,
    // One row up front: every voucher has at least one, and an empty table reads
    // as "nothing to fill in here".
    lines: [newLine()],
    notes: '',
  };
}

/**
 * Picking a method moves the voucher type with it, and clears the fields that
 * belonged to the method being left behind — a leftover cheque number on a cash
 * voucher is a fact about a payment that never happened.
 *
 * The paying accounts are cleared too: a cash account is the wrong answer for a
 * bank voucher, and keeping it would let a mismatched pair through the one gate
 * that cannot check it. Their amounts survive the switch — the sum was agreed
 * with the supplier, only the rekening it leaves from is now in question.
 */
export function applyPaymentMethod(
  form: VoucherFormState,
  paymentMethod: VoucherPaymentMethod,
): VoucherFormState {
  const fund = fundForPaymentMethod(paymentMethod);
  const fundChanged = fund !== form.fund;

  return {
    ...form,
    paymentMethod,
    fund,
    funds: fundChanged ? form.funds.map((row) => ({ ...row, accountId: '' })) : form.funds,
    transferChannel: requiresTransferChannel(paymentMethod) ? form.transferChannel : undefined,
    dueDate: requiresDueDate(paymentMethod) ? form.dueDate : undefined,
    ...(fund === 'BANK' ? {} : { bankName: '', bankAccountNo: '' }),
  };
}

/** Detail VO → form state. The VO renders "—" for blanks; the form needs `''`. */
export function toFormState(voucher: CashVoucherDetailVO): VoucherFormState {
  const value = (input: string): string => (input === '—' ? '' : input);

  return {
    fund: voucher.fund,
    direction: voucher.direction,
    date: fromDateOnly(voucher.date),
    category: voucher.category,
    counterpartyName: voucher.counterpartyName,
    partnerId: voucher.partnerId ?? '',
    purpose: voucher.purpose,
    funds: voucher.funds.map((fund) => ({
      key: fund.id,
      accountId: fund.accountId,
      amount: fund.amount,
      note: value(fund.note),
    })),
    paymentMethod: voucher.paymentMethod,
    transferChannel: voucher.transferChannel,
    bankName: value(voucher.bankName),
    bankAccountNo: value(voucher.bankAccountNo),
    referenceNumber: value(voucher.referenceNumber),
    dueDate: voucher.dueDate ? fromDateOnly(voucher.dueDate) : undefined,
    autoPostOnApproval: voucher.autoPostOnApproval,
    lines: voucher.lines.map((line) => ({
      key: line.id,
      accountId: line.accountId,
      description: value(line.description),
      amount: line.amount,
    })),
    notes: value(voucher.notes),
  };
}

/** Form state → the exact snake_case body the API validates. */
export function toPayload(form: VoucherFormState): CashVoucherWritePayload {
  return {
    fund: form.fund,
    direction: form.direction,
    date: form.date ? toDateOnly(form.date) : '',
    category: form.category,
    counterparty_name: form.counterpartyName.trim(),
    ...(form.partnerId ? { partner_id: form.partnerId } : {}),
    purpose: form.purpose.trim(),
    funds: form.funds.map((fund) => ({
      account_id: fund.accountId,
      amount: fund.amount ?? 0,
      ...(fund.note.trim() ? { note: fund.note.trim() } : {}),
    })),
    payment_method: form.paymentMethod,
    transfer_channel: form.transferChannel ?? null,
    ...(form.bankName.trim() ? { bank_name: form.bankName.trim() } : {}),
    ...(form.bankAccountNo.trim() ? { bank_account_no: form.bankAccountNo.trim() } : {}),
    ...(form.referenceNumber.trim() ? { reference_number: form.referenceNumber.trim() } : {}),
    due_date: form.dueDate ? toDateOnly(form.dueDate) : null,
    auto_post_on_approval: form.autoPostOnApproval,
    lines: form.lines.map((line) => ({
      account_id: line.accountId,
      ...(line.description.trim() ? { description: line.description.trim() } : {}),
      amount: line.amount ?? 0,
    })),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}

/**
 * Live preview of the voucher total, summed with the very function the route
 * handler stores from — the figure under the table and the column in the
 * database are the same arithmetic, not two implementations of it.
 */
export function previewTotal(form: VoucherFormState): number {
  return sumVoucherLines(form.lines.map((line) => ({ amount: line.amount ?? 0 })));
}

/**
 * The same preview for the paying side. Both sums use the one function the route
 * handler stores from, so "belum sama" on screen and the rejection from the API
 * can never disagree about which one it is.
 */
export function previewFundTotal(form: VoucherFormState): number {
  return sumVoucherLines(form.funds.map((fund) => ({ amount: fund.amount ?? 0 })));
}
