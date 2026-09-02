import { describe, expect, it } from 'vitest';
import {
  convertUnits,
  convertToAnchor,
  convertFromAnchor,
  getConversionBreakdown,
  findUnit,
  computeAnchorEquivalent,
  suggestCategoryForPR,
  type UnitConversionParams,
} from './unit-conversion';

describe('unit-conversion engine', () => {
  const GRAM: UnitConversionParams = {
    code: 'G',
    name: 'Gram',
    symbol: 'g',
    categoryCode: 'WEIGHT',
    isAnchor: true,
    conversionFactor: 1,
  };

  const CENTIGRAM: UnitConversionParams = {
    code: 'CG',
    name: 'Centigram',
    symbol: 'cg',
    categoryCode: 'WEIGHT',
    isAnchor: false,
    conversionFactor: 0.01, // 1/100 g
  };

  const KILOGRAM: UnitConversionParams = {
    code: 'KG',
    name: 'Kilogram',
    symbol: 'kg',
    categoryCode: 'WEIGHT',
    isAnchor: false,
    conversionFactor: 1000, // 1000 g
  };

  const TROY_OZ: UnitConversionParams = {
    code: 'TROY_OZ',
    name: 'Troy Ounce',
    symbol: 'oz t',
    categoryCode: 'WEIGHT',
    isAnchor: false,
    conversionFactor: 31.1034768,
  };

  const PCS: UnitConversionParams = {
    code: 'PCS',
    name: 'Piece',
    symbol: 'pcs',
    categoryCode: 'UNIT',
    isAnchor: true,
    conversionFactor: 1,
  };

  const DOZEN: UnitConversionParams = {
    code: 'DOZEN',
    name: 'Lusin',
    symbol: 'dz',
    categoryCode: 'UNIT',
    isAnchor: false,
    conversionFactor: 12,
  };

  const LITER: UnitConversionParams = {
    code: 'L',
    name: 'Liter',
    symbol: 'L',
    categoryCode: 'VOLUME',
    isAnchor: true,
    conversionFactor: 1,
  };

  const ML: UnitConversionParams = {
    code: 'ML',
    name: 'Mililiter',
    symbol: 'mL',
    categoryCode: 'VOLUME',
    isAnchor: false,
    conversionFactor: 0.001,
  };

  const JERIGEN_30L: UnitConversionParams = {
    code: 'JRG_30L',
    name: 'Jerigen 30L',
    symbol: 'jrg 30L',
    categoryCode: 'VOLUME',
    isAnchor: false,
    conversionFactor: 30,
  };

  it('mengonversi nilai ke Anchor unit dengan tepat', () => {
    expect(convertToAnchor(100, CENTIGRAM)).toBe(1); // 100 cg = 1 g
    expect(convertToAnchor(2, KILOGRAM)).toBe(2000); // 2 kg = 2000 g
    expect(convertToAnchor(5, GRAM)).toBe(5); // 5 g = 5 g
  });

  it('mengonversi nilai dari Anchor unit ke unit lain dengan tepat', () => {
    expect(convertFromAnchor(1, CENTIGRAM)).toBe(100); // 1 g = 100 cg
    expect(convertFromAnchor(2000, KILOGRAM)).toBe(2); // 2000 g = 2 kg
  });

  it('mengonversi Centigram ke KG sesuai contoh user: 1 cg -> 1/100000 kg (0.00001 kg)', () => {
    const result = convertUnits(1, CENTIGRAM, KILOGRAM, 6);
    expect(result).toBe(0.00001);

    const breakdown = getConversionBreakdown(1, CENTIGRAM, KILOGRAM, GRAM, 6);
    expect(breakdown.anchorValue).toBe(0.01);
    expect(breakdown.resultValue).toBe(0.00001);
    expect(breakdown.steps.length).toBe(2);
    expect(breakdown.steps[0]).toContain('1 cg × 0.01 = 0.01 g');
    expect(breakdown.steps[1]).toContain('0.01 ÷ 1000 = 0.00001 kg');
  });

  it('mengonversi KG ke Centigram: 1 kg = 100.000 cg', () => {
    const result = convertUnits(1, KILOGRAM, CENTIGRAM, 2);
    expect(result).toBe(100000);
  });

  it('mengonversi gram ke troy ounce emas: 31.1034768 g = 1 oz t', () => {
    const result = convertUnits(31.1034768, GRAM, TROY_OZ, 4);
    expect(result).toBe(1);
  });

  it('mengonversi lusin ke pcs: 2.5 lusin = 30 pcs', () => {
    const result = convertUnits(2.5, DOZEN, PCS, 0);
    expect(result).toBe(30);
  });

  it('mengonversi jerigen 30L ke mL: 1 jerigen = 30.000 mL', () => {
    const result = convertUnits(1, JERIGEN_30L, ML, 0);
    expect(result).toBe(30000);
  });

  it('mengembalikan nilai asli bila unit asal dan tujuan sama', () => {
    expect(convertUnits(42, GRAM, GRAM)).toBe(42);
    const breakdown = getConversionBreakdown(42, GRAM, GRAM, GRAM);
    expect(breakdown.resultValue).toBe(42);
  });

  it('melempar error jika mengonversi antar kategori yang berbeda', () => {
    expect(() => convertUnits(10, GRAM, LITER)).toThrow('Tidak dapat mengonversi satuan antar kategori');
  });

  it('menemukan satuan melalui query, simbol, atau alias', () => {
    expect(findUnit('kg')?.code).toBe('KG');
    expect(findUnit('Gram')?.code).toBe('G');
    expect(findUnit('troy oz')?.code).toBe('TROY_OZ');
    expect(findUnit('oz')?.code).toBe('TROY_OZ');
    expect(findUnit('lusin')?.code).toBe('DOZEN');
    expect(findUnit('jerigen (30kg)')?.code).toBe('JRG_30L');
    expect(findUnit('liter')?.code).toBe('L');
    expect(findUnit('pcs')?.code).toBe('PCS');
  });

  it('menghitung ekuivalensi anchor dengan presisi untuk purchase request', () => {
    // 2 kg -> 2000 gram (anchor)
    const eqKg = computeAnchorEquivalent(2, 'kg');
    expect(eqKg?.isAnchor).toBe(false);
    expect(eqKg?.anchorQuantity).toBe(2000);
    expect(eqKg?.anchorUnit.code).toBe('G');
    expect(eqKg?.formatted).toContain('2.000 g (Gram)');

    // 100 cg -> 1 gram (anchor)
    const eqCg = computeAnchorEquivalent(100, 'cg');
    expect(eqCg?.isAnchor).toBe(false);
    expect(eqCg?.anchorQuantity).toBe(1);
    expect(eqCg?.formatted).toContain('1 g (Gram)');

    // 5 gram -> anchor itself
    const eqG = computeAnchorEquivalent(5, 'g');
    expect(eqG?.isAnchor).toBe(true);
    expect(eqG?.anchorQuantity).toBe(5);
    expect(eqG?.formatted).toContain('5 g (Anchor)');

    // 3 Jerigen 30L -> 90 Liter (anchor)
    const eqJrg = computeAnchorEquivalent(3, 'jrg 30L');
    expect(eqJrg?.isAnchor).toBe(false);
    expect(eqJrg?.anchorQuantity).toBe(90);
    expect(eqJrg?.anchorUnit.code).toBe('L');

    // 5 lusin -> 60 pcs (anchor)
    const eqLsn = computeAnchorEquivalent(5, 'lusin');
    expect(eqLsn?.isAnchor).toBe(false);
    expect(eqLsn?.anchorQuantity).toBe(60);
    expect(eqLsn?.anchorUnit.code).toBe('PCS');
  });

  it('merekomendasikan kategori satuan yang cocok dengan kategori PR', () => {
    expect(suggestCategoryForPR('GOLD_LOCAL')).toBe('WEIGHT');
    expect(suggestCategoryForPR('GOLD_IMPORT')).toBe('WEIGHT');
    expect(suggestCategoryForPR('LAB_CHEMICALS')).toBe('VOLUME');
    expect(suggestCategoryForPR('GENERAL_SUPPLIES')).toBe('UNIT');
  });
});
