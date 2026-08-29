import { describe, expect, it } from 'vitest';

import { convertAmount, formatMoney, fxSymbol, rateLabel } from './currency';

describe('fxSymbol', () => {
  it('builds the Yahoo Finance pair symbol', () => {
    expect(fxSymbol('USD', 'IDR')).toBe('USDIDR=X');
    expect(fxSymbol('SGD', 'JPY')).toBe('SGDJPY=X');
  });
});

describe('convertAmount', () => {
  it('rounds to the quote currency precision', () => {
    expect(convertAmount(100, 16250.5, 0)).toBe(1625050);
    expect(convertAmount(1, 16250.567, 2)).toBe(16250.57);
    // JPY has no minor unit, KWD has three — a fixed 2 would be wrong by 10x.
    expect(convertAmount(10, 150.456, 0)).toBe(1505);
    expect(convertAmount(10, 0.30712, 3)).toBe(3.071);
  });

  it('defaults to two decimals', () => {
    expect(convertAmount(3, 1.23456)).toBe(3.7);
  });
});

describe('formatMoney', () => {
  it('uses the symbol when there is one, the code otherwise', () => {
    expect(formatMoney(1234.5, { code: 'USD', symbol: '$' })).toBe('$ 1.234,50');
    expect(formatMoney(1234.5, { code: 'XPF' })).toBe('XPF 1.234,50');
  });

  it('pads to the currency precision', () => {
    expect(formatMoney(16250, { code: 'IDR', symbol: 'Rp', decimalDigits: 0 })).toBe('Rp 16.250');
    expect(formatMoney(1500, { code: 'JPY', symbol: '¥', decimalDigits: 0 })).toBe('¥ 1.500');
  });

  it('renders nothing for a non-finite value', () => {
    expect(formatMoney(Number.NaN, { code: 'USD', symbol: '$' })).toBe('');
  });
});

describe('rateLabel', () => {
  it('reads as one sentence', () => {
    expect(rateLabel('USD', 16250, { code: 'IDR', symbol: 'Rp', decimalDigits: 0 })).toBe(
      '1 USD = Rp 16.250',
    );
  });
});
