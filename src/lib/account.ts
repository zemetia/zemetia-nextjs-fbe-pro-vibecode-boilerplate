import { accountClassDigit, type AccountClassDigit } from './account-code';
import type { AccountType, NormalBalance } from '@/types/value-objects';

/**
 * Presentation and classification rules for the chart of accounts. The database
 * stores English identifiers; everything on screen reads Indonesian and comes
 * from here — never from a per-component ternary.
 */

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  COST_EXPENSE: 'HPP & Beban',
  NON_OPERATING: 'Di Luar Usaha',
};

export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(
  (value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] }),
);

/**
 * The class digit is the account's type — the two can never disagree, so the
 * `type` column is always written from the code, never chosen by the user.
 */
const TYPE_BY_CLASS_DIGIT: Record<AccountClassDigit, AccountType> = {
  1: 'ASSET',
  2: 'LIABILITY',
  3: 'EQUITY',
  4: 'REVENUE',
  5: 'COST_EXPENSE',
  6: 'NON_OPERATING',
};

const CLASS_DIGIT_BY_TYPE: Record<AccountType, AccountClassDigit> = {
  ASSET: 1,
  LIABILITY: 2,
  EQUITY: 3,
  REVENUE: 4,
  COST_EXPENSE: 5,
  NON_OPERATING: 6,
};

function isClassDigit(digit: number | null): digit is AccountClassDigit {
  return digit !== null && digit in TYPE_BY_CLASS_DIGIT;
}

/** `11213` → `ASSET`. `null` when the code is off the scheme or class 7..9. */
export function accountTypeFromCode(code: string): AccountType | null {
  const digit = accountClassDigit(code);
  return isClassDigit(digit) ? TYPE_BY_CLASS_DIGIT[digit] : null;
}

export function classDigitForType(type: AccountType): AccountClassDigit {
  return CLASS_DIGIT_BY_TYPE[type];
}

/**
 * Saldo normal. Debit grows assets and costs; credit grows liabilities, equity
 * and income. Class 6 mixes non-operating income and expense in one branch and
 * is reported net, so it follows the income side.
 */
const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  ASSET: 'DEBIT',
  LIABILITY: 'CREDIT',
  EQUITY: 'CREDIT',
  REVENUE: 'CREDIT',
  COST_EXPENSE: 'DEBIT',
  NON_OPERATING: 'CREDIT',
};

export const NORMAL_BALANCE_LABELS: Record<NormalBalance, string> = {
  DEBIT: 'Debit',
  CREDIT: 'Kredit',
};

export function normalBalanceForType(type: AccountType): NormalBalance {
  return NORMAL_BALANCE_BY_TYPE[type];
}

/**
 * Signed movement for one account: debit minus credit for a debit-normal
 * account, credit minus debit for a credit-normal one — so a balance shown on
 * screen is positive whenever the account behaves as expected.
 */
export function signedBalance(type: AccountType, debit: number, credit: number): number {
  return normalBalanceForType(type) === 'DEBIT' ? debit - credit : credit - debit;
}
