import { describe, expect, it } from 'vitest';

import {
  isOverLossTolerance,
  isProductionOrderEditable,
  acceptsMetalMovement,
  canVoidProductionOrder,
  lossPercentOf,
  materialPlan,
  yieldPercentOf,
} from './production';

describe('materialPlan', () => {
  it('membagi berat kotor jadi emas murni dan alloy sesuai kadar', () => {
    expect(materialPlan(100, 75)).toEqual({ fineNeededGram: 75, alloyNeededGram: 25 });
  });

  it('tidak menuntut alloy sama sekali untuk kadar penuh', () => {
    expect(materialPlan(50, 100)).toEqual({ fineNeededGram: 50, alloyNeededGram: 0 });
  });

  it('menjaga jumlah keduanya tetap sama dengan berat kotor meski kadarnya pecahan', () => {
    // 91,6% dari 33,333 g tidak bulat; alloy dihitung dari selisih terhadap
    // angka yang sudah dibulatkan, supaya keduanya bisa dijumlah ulang di layar.
    const plan = materialPlan(33.333, 91.6);

    expect(plan.fineNeededGram + plan.alloyNeededGram).toBe(33.333);
  });
});

describe('lossPercentOf', () => {
  it('mengukur susut terhadap emas yang benar-benar diolah', () => {
    expect(lossPercentOf(1, 100)).toBe(1);
  });

  it('mengembalikan nol saat belum ada yang diolah, bukan membagi dengan nol', () => {
    expect(lossPercentOf(0, 0)).toBe(0);
    expect(lossPercentOf(5, 0)).toBe(0);
  });
});

describe('yieldPercentOf', () => {
  it('menghitung berapa persen bahan yang berakhir sebagai barang', () => {
    expect(yieldPercentOf(99, 100)).toBe(99);
  });
});

describe('isOverLossTolerance', () => {
  it('menganggap susut yang persis di batas masih dalam toleransi', () => {
    expect(isOverLossTolerance(2, 2)).toBe(false);
    expect(isOverLossTolerance(2.0001, 2)).toBe(true);
  });
});

describe('transisi status', () => {
  it('hanya draft yang boleh diubah', () => {
    expect(isProductionOrderEditable('DRAFT')).toBe(true);
    expect(isProductionOrderEditable('RELEASED')).toBe(false);
  });

  it('emas hanya boleh bergerak untuk SPK yang sedang berjalan', () => {
    expect(acceptsMetalMovement('RELEASED')).toBe(true);
    expect(acceptsMetalMovement('DRAFT')).toBe(false);
    expect(acceptsMetalMovement('CLOSED')).toBe(false);
  });

  it('SPK yang sudah ditutup tidak bisa dibatalkan lagi', () => {
    expect(canVoidProductionOrder('RELEASED')).toBe(true);
    expect(canVoidProductionOrder('CLOSED')).toBe(false);
    expect(canVoidProductionOrder('VOID')).toBe(false);
  });
});
