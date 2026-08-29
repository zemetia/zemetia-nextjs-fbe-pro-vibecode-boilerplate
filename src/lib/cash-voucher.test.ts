import { describe, expect, it } from 'vitest';

import {
  buildVoucherJournalLines,
  fundForPaymentMethod,
  isPaymentMethodAllowed,
  paymentMethodsForFund,
  requiresDueDate,
  sumVoucherLines,
  voucherKind,
  VOUCHER_PAYMENT_METHODS,
} from './cash-voucher';

describe('voucherKind', () => {
  it('derives the four field abbreviations from fund × direction', () => {
    expect(voucherKind('CASH', 'IN')).toBe('BKM');
    expect(voucherKind('CASH', 'OUT')).toBe('BKK');
    expect(voucherKind('BANK', 'IN')).toBe('BBM');
    expect(voucherKind('BANK', 'OUT')).toBe('BBK');
  });

  it('files memorial under one code in both directions', () => {
    expect(voucherKind('MEMORIAL', 'IN')).toBe('BM');
    expect(voucherKind('MEMORIAL', 'OUT')).toBe('BM');
  });
});

describe('payment method ↔ fund', () => {
  it('keeps gold and netting off cash and bank', () => {
    // These settle no money at all — booking them against cash would report a
    // balance that never moved, with nothing on screen looking wrong.
    expect(isPaymentMethodAllowed('GOLD', 'CASH')).toBe(false);
    expect(isPaymentMethodAllowed('GOLD', 'BANK')).toBe(false);
    expect(isPaymentMethodAllowed('GOLD', 'MEMORIAL')).toBe(true);
    expect(isPaymentMethodAllowed('NETTING', 'MEMORIAL')).toBe(true);
  });

  it('keeps bank instruments off a cash voucher', () => {
    expect(isPaymentMethodAllowed('GIRO', 'CASH')).toBe(false);
    expect(isPaymentMethodAllowed('CASH', 'BANK')).toBe(false);
  });

  it('offers every method under exactly one fund', () => {
    const offered = (['CASH', 'BANK', 'MEMORIAL'] as const).flatMap(paymentMethodsForFund);

    expect(offered).toHaveLength(VOUCHER_PAYMENT_METHODS.length);
    expect(new Set(offered).size).toBe(VOUCHER_PAYMENT_METHODS.length);
  });

  it('agrees with the fund each method implies', () => {
    for (const method of VOUCHER_PAYMENT_METHODS) {
      expect(isPaymentMethodAllowed(method, fundForPaymentMethod(method))).toBe(true);
    }
  });

  it('asks for a clearing date only where the money moves later', () => {
    expect(requiresDueDate('CHEQUE')).toBe(true);
    expect(requiresDueDate('GIRO')).toBe(true);
    expect(requiresDueDate('BANK_TRANSFER')).toBe(false);
  });
});

describe('sumVoucherLines', () => {
  it('rounds each row before summing so the total matches the printed figures', () => {
    expect(sumVoucherLines([{ amount: 0.005 }, { amount: 0.005 }])).toBe(0.02);
  });

  it('does not accumulate float drift', () => {
    expect(sumVoucherLines([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });

  it('is zero for a voucher with no rows', () => {
    expect(sumVoucherLines([])).toBe(0);
  });
});

describe('buildVoucherJournalLines', () => {
  const lines = [
    { accountId: 'expense', amount: 1_850_000, memo: 'Emas' },
    { accountId: 'freight', amount: 4_500, memo: null },
  ];

  const cash = [{ accountId: 'cash', amount: 1_854_500, memo: null }];

  it('debits the detail and credits cash on the way out', () => {
    const entry = buildVoucherJournalLines('OUT', cash, lines);

    expect(entry).toHaveLength(3);
    expect(entry[0]).toMatchObject({ accountId: 'expense', debit: 1_850_000 });
    expect(entry.at(-1)).toMatchObject({ accountId: 'cash', credit: 1_854_500 });
  });

  it('mirrors the sides on the way in', () => {
    const entry = buildVoucherJournalLines('IN', cash, lines);

    expect(entry[0]).toMatchObject({ accountId: 'cash', debit: 1_854_500 });
    expect(entry.at(-1)).toMatchObject({ accountId: 'freight', credit: 4_500 });
  });

  it('balances in both directions', () => {
    for (const direction of ['IN', 'OUT'] as const) {
      const entry = buildVoucherJournalLines(direction, cash, lines);
      const debit = entry.reduce((total, line) => total + (line.debit ?? 0), 0);
      const credit = entry.reduce((total, line) => total + (line.credit ?? 0), 0);

      expect(debit).toBe(credit);
    }
  });

  // Satu pembayaran yang keluar dari dua rekening tetap satu dokumen: kedua
  // sisinya daftar, jadi keseimbangan adalah konsekuensi bentuknya.
  it('spreads the fund side across every account that paid', () => {
    const split = [
      { accountId: 'bca', amount: 1_000_000, memo: 'Transfer pertama' },
      { accountId: 'mandiri', amount: 854_500, memo: null },
    ];

    const entry = buildVoucherJournalLines('OUT', split, lines);
    const debit = entry.reduce((total, line) => total + (line.debit ?? 0), 0);
    const credit = entry.reduce((total, line) => total + (line.credit ?? 0), 0);

    expect(entry).toHaveLength(4);
    expect(debit).toBe(credit);
    expect(entry.at(-2)).toMatchObject({ accountId: 'bca', credit: 1_000_000 });
    expect(entry.at(-1)).toMatchObject({ accountId: 'mandiri', credit: 854_500 });
  });
});
