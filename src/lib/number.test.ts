import { describe, expect, it } from 'vitest';

import {
  countDigits,
  formatCurrency,
  formatNumber,
  groupDigits,
  parseNumber,
  toNumberDisplay,
} from './number';

describe('groupDigits', () => {
  it('inserts a dot every three digits', () => {
    expect(groupDigits('100000')).toBe('100.000');
    expect(groupDigits('1234567')).toBe('1.234.567');
    expect(groupDigits('999')).toBe('999');
    expect(groupDigits('')).toBe('');
  });
});

describe('formatNumber', () => {
  it('formats integers with dot separators', () => {
    expect(formatNumber(100000)).toBe('100.000');
    expect(formatNumber(0)).toBe('0');
  });

  it('drops decimals unless decimalScale allows them', () => {
    expect(formatNumber(1234.56)).toBe('1.235');
    expect(formatNumber(1234.56, { decimalScale: 2 })).toBe('1.234,56');
  });

  it('pads decimals when fixed', () => {
    expect(formatNumber(1234.5, { decimalScale: 2, fixed: true })).toBe('1.234,50');
  });

  it('returns an empty string for non-finite input', () => {
    expect(formatNumber(Number.NaN)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('prefixes with Rp', () => {
    expect(formatCurrency(1234567)).toBe('Rp 1.234.567');
  });
});

describe('parseNumber', () => {
  it('parses a formatted string back to a number', () => {
    expect(parseNumber('1.234.567')).toBe(1234567);
    expect(parseNumber('Rp 1.234.567,5')).toBe(1234567.5);
    expect(parseNumber('-1.500')).toBe(-1500);
  });

  it('returns undefined when there is no digit', () => {
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('Rp ')).toBeUndefined();
  });
});

describe('toNumberDisplay', () => {
  it('formats raw typing', () => {
    expect(toNumberDisplay('100000')).toBe('100.000');
    expect(toNumberDisplay('12ab34')).toBe('1.234');
  });

  it('strips leading zeros', () => {
    expect(toNumberDisplay('000123')).toBe('123');
    expect(toNumberDisplay('0')).toBe('0');
  });

  it('keeps a half-typed decimal', () => {
    expect(toNumberDisplay('1000,', { decimalScale: 2 })).toBe('1.000,');
    expect(toNumberDisplay('1000,555', { decimalScale: 2 })).toBe('1.000,55');
  });

  it('drops the decimals entirely when decimalScale is 0', () => {
    expect(toNumberDisplay('1000,55')).toBe('1.000');
  });

  it('honours allowNegative', () => {
    expect(toNumberDisplay('-1500')).toBe('1.500');
    expect(toNumberDisplay('-1500', { allowNegative: true })).toBe('-1.500');
    expect(toNumberDisplay('-', { allowNegative: true })).toBe('-');
  });
});

describe('countDigits', () => {
  it('counts only digits', () => {
    expect(countDigits('1.234,5')).toBe(5);
    expect(countDigits('Rp ')).toBe(0);
  });
});
