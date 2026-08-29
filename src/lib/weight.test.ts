import { describe, expect, it } from 'vitest';

import { computeMetalPurchaseItem, METAL_PURCHASE_PRICE_SCALE } from './metal-purchase';
import { convertPricePerUnit, convertWeight, GRAM_PER_TROY_OUNCE } from './weight';

/**
 * Menukar satuan sebuah baris.
 *
 * Yang diuji di sini bukan aritmetikanya sendiri — itu satu perkalian — melainkan
 * **invarian yang membuat tombol tukar aman dipencet**: nilai barisnya tidak
 * boleh bergerak. Kegagalan di sini tidak melempar apa pun dan tidak terlihat di
 * layar; ia cuma menggeser harga yang sudah disepakati supplier.
 */

describe('convertWeight', () => {
  it('menyatakan berat yang sama, bukan angka yang sama', () => {
    expect(convertWeight(1000, 'GRAM', 'TROY_OUNCE')).toBe(32.1507);
    expect(convertWeight(400, 'TROY_OUNCE', 'GRAM')).toBe(12441.3907);
  });

  it('satuan yang sama dikembalikan apa adanya — tanpa pembulatan yang tidak diminta', () => {
    expect(convertWeight(33.33335, 'GRAM', 'GRAM')).toBe(33.33335);
  });

  it('memakai ounce troy, bukan ons timbangan', () => {
    expect(convertWeight(1, 'TROY_OUNCE', 'GRAM')).toBe(
      Math.round(GRAM_PER_TROY_OUNCE * 10_000) / 10_000,
    );
  });
});

describe('convertPricePerUnit', () => {
  it('bergerak berlawanan arah dengan beratnya', () => {
    expect(
      convertPricePerUnit(1_000_000, 'GRAM', 'TROY_OUNCE', METAL_PURCHASE_PRICE_SCALE),
    ).toBe(31_103_476.8);
    expect(convertPricePerUnit(2_410, 'TROY_OUNCE', 'GRAM', METAL_PURCHASE_PRICE_SCALE)).toBe(
      77.48329923,
    );
  });
});

describe('menukar satuan sebuah baris', () => {
  /** Satu baris batangan, dihitung dengan fungsi yang dipakai form dan server. */
  function amountAfterSwitch(
    weight: number,
    pricePerUnit: number,
    from: 'GRAM' | 'TROY_OUNCE',
    to: 'GRAM' | 'TROY_OUNCE',
  ): { before: number; after: number } {
    const shared = { purityPercent: 99.99, pure: true, priceBasis: 'GROSS' } as const;

    return {
      before: computeMetalPurchaseItem({ ...shared, weight, weightUnit: from, pricePerUnit })
        .amount,
      after: computeMetalPurchaseItem({
        ...shared,
        weight: convertWeight(weight, from, to),
        weightUnit: to,
        pricePerUnit: convertPricePerUnit(pricePerUnit, from, to, METAL_PURCHASE_PRICE_SCALE),
      }).amount,
    };
  }

  /**
   * **Menukar satuan tidak gratis, dan besar biayanya bisa disebut.**
   *
   * Empat desimal sebuah ounce lebih kasar daripada empat desimal sebuah gram —
   * tiga puluh satu kali lipat — jadi 1.000 g yang jadi 32,1507 oz kehilangan
   * sisa di bawah setengah satuan terakhirnya: paling banyak 0,00005 oz, yaitu
   * 0,0016 g. Itu batas kolomnya sendiri (`Decimal(14,4)`), bukan kelemahan
   * konversinya, dan ia **tidak menumpuk**: menukar bolak-balik berhenti di
   * angka yang sama (diuji di bawah).
   */
  const OUNCE_ROUNDING_RELATIVE = 2e-6;

  it('nilai baris hampir tidak bergerak saat gram ditukar ke ounce', () => {
    const { before, after } = amountAfterSwitch(1000, 1_000_000, 'GRAM', 'TROY_OUNCE');

    expect(before).toBe(1_000_000_000);
    // Rp 1.448 atas Rp 1 miliar — seluruhnya berasal dari berat yang dibulatkan
    // ke empat desimal ounce, dan angkanya tampil apa adanya di layar karena
    // `withWeightUnit()` menghitung ulang nilainya dari pasangan yang baru.
    expect(Math.abs(after - before)).toBeLessThan(before * OUNCE_ROUNDING_RELATIVE);
  });

  it('dan tidak bergerak sama sekali saat ounce ditukar ke gram — 400 oz @ USD 2.410', () => {
    const { before, after } = amountAfterSwitch(400, 2_410, 'TROY_OUNCE', 'GRAM');

    // Arah ini justru bertambah presisi: gram punya desimal yang lebih halus,
    // jadi tidak ada yang hilang saat dibulatkan.
    expect(before).toBe(964_000);
    expect(Math.abs(after - before)).toBeLessThan(1);
  });

  it('menukar bolak-balik berhenti — pembulatannya tidak menumpuk tiap klik', () => {
    const once = convertWeight(1000, 'GRAM', 'TROY_OUNCE');
    const back = convertWeight(once, 'TROY_OUNCE', 'GRAM');
    const twice = convertWeight(back, 'GRAM', 'TROY_OUNCE');

    expect(twice).toBe(once);
    expect(convertWeight(twice, 'TROY_OUNCE', 'GRAM')).toBe(back);
  });

  it('berat kanoniknya tetap gram yang sama, jadi gudang tidak ikut bergeser', () => {
    const asOunce = computeMetalPurchaseItem({
      weight: convertWeight(1000, 'GRAM', 'TROY_OUNCE'),
      weightUnit: 'TROY_OUNCE',
      purityPercent: 99.99,
      pure: true,
      priceBasis: 'GROSS',
      pricePerUnit: 0,
    });

    expect(asOunce.weightGram).toBeCloseTo(1000, 2);
  });
});
