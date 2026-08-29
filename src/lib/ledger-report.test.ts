import { describe, expect, it } from 'vitest';

import {
  addSides,
  isBalanced,
  movementBalance,
  runningBalances,
  sidesForType,
  toSides,
} from '@/lib/ledger-report';

describe('movementBalance', () => {
  it('reads a debit-normal account as debit minus credit', () => {
    expect(movementBalance('ASSET', { debit: 1_000_000, credit: 250_000 })).toBe(750_000);
    expect(movementBalance('COST_EXPENSE', { debit: 500_000, credit: 0 })).toBe(500_000);
  });

  it('flips the sign for credit-normal accounts so a healthy balance is positive', () => {
    // Bug laporan lama: kewajiban, ekuitas, dan pendapatan selalu tampil negatif
    // karena saldonya dihitung debit - credit untuk semua jenis akun.
    expect(movementBalance('LIABILITY', { debit: 0, credit: 4_050_000_000 })).toBe(4_050_000_000);
    expect(movementBalance('REVENUE', { debit: 0, credit: 900_000 })).toBe(900_000);
    expect(movementBalance('EQUITY', { debit: 100_000, credit: 500_000 })).toBe(400_000);
  });
});

describe('toSides', () => {
  it('puts an account on its normal side while the balance behaves', () => {
    expect(toSides(750_000, 'DEBIT')).toEqual({ debit: 750_000, credit: 0 });
    expect(toSides(4_050_000_000, 'CREDIT')).toEqual({ debit: 0, credit: 4_050_000_000 });
  });

  it('moves it across when the balance runs the other way', () => {
    // Kas yang menurut buku minus berdiri di kolom kredit — justru di situ ia
    // terlihat, bukan sebagai angka negatif di kolom debit.
    expect(toSides(-250_000, 'DEBIT')).toEqual({ debit: 0, credit: 250_000 });
    expect(toSides(-1_000, 'CREDIT')).toEqual({ debit: 1_000, credit: 0 });
  });

  it('treats a zero balance as resting on its normal side', () => {
    expect(toSides(0, 'DEBIT')).toEqual({ debit: 0, credit: 0 });
    expect(toSides(0, 'CREDIT')).toEqual({ debit: 0, credit: 0 });
  });

  it('derives the side from the account type when given one', () => {
    expect(sidesForType(500_000, 'ASSET')).toEqual({ debit: 500_000, credit: 0 });
    expect(sidesForType(500_000, 'REVENUE')).toEqual({ debit: 0, credit: 500_000 });
  });
});

describe('runningBalances', () => {
  it('accumulates forward from the opening balance, one value per row', () => {
    const rows = [
      { debit: 1_000_000, credit: 0 },
      { debit: 0, credit: 400_000 },
      { debit: 250_000, credit: 0 },
    ];

    expect(runningBalances('ASSET', 500_000, rows)).toEqual([1_500_000, 1_100_000, 1_350_000]);
  });

  it('starts from the opening balance rather than from zero', () => {
    // Laporan yang memulai dari nol tiap kali periodenya digeser akan
    // melaporkan saldo kas berubah karena filternya berubah.
    expect(runningBalances('ASSET', 2_000_000, [{ debit: 0, credit: 500_000 }])).toEqual([
      1_500_000,
    ]);
  });

  it('runs a credit-normal account upward as it is credited', () => {
    const rows = [
      { debit: 0, credit: 3_000_000 },
      { debit: 1_000_000, credit: 0 },
    ];

    expect(runningBalances('LIABILITY', 0, rows)).toEqual([3_000_000, 2_000_000]);
  });

  it('keeps every step rounded to the cent', () => {
    const rows = [
      { debit: 0.1, credit: 0 },
      { debit: 0.2, credit: 0 },
    ];

    // 0.1 + 0.2 sebagai float adalah 0.30000000000000004, dan sisa sekecil itu
    // yang menumpuk muncul sebagai neraca saldo selisih satu sen.
    expect(runningBalances('ASSET', 0, rows)).toEqual([0.1, 0.3]);
  });
});

describe('isBalanced', () => {
  it('accepts equal sides and rejects a difference of one cent', () => {
    expect(isBalanced(addSides({ debit: 100, credit: 0 }, { debit: 0, credit: 100 }))).toBe(true);
    expect(isBalanced({ debit: 100, credit: 100.01 })).toBe(false);
  });
});
