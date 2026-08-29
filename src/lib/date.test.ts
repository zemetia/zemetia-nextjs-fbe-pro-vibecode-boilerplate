import { describe, expect, it } from 'vitest';

import {
  formatDateLong,
  formatDateShort,
  fromDateOnly,
  fromUtcDateOnly,
  toDateOnly,
  toUtcDateOnly,
} from './date';

describe('date-only helpers', () => {
  it('serialises a local date without shifting the day', () => {
    expect(toDateOnly(new Date(2026, 7, 10))).toBe('2026-08-10');
  });

  it('keeps the day when a local midnight would move under UTC', () => {
    // 00:00 on 1 Jan is the previous year in UTC for any positive offset —
    // toISOString() would report 2025-12-31.
    expect(toDateOnly(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('round-trips through the wire format', () => {
    const parsed = fromDateOnly(toDateOnly(new Date(2026, 11, 31)));

    expect(parsed).toBeDefined();
    expect(parsed && toDateOnly(parsed)).toBe('2026-12-31');
  });

  it('rejects anything that is not a bare calendar day', () => {
    expect(fromDateOnly('2026-8-1')).toBeUndefined();
    expect(fromDateOnly('2026-08-10T00:00:00Z')).toBeUndefined();
    expect(fromDateOnly('')).toBeUndefined();
    expect(fromDateOnly(null)).toBeUndefined();
  });

  it('stores and reads a Date column at UTC midnight', () => {
    const stored = toUtcDateOnly('2026-08-10');

    expect(stored.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(fromUtcDateOnly(stored)).toBe('2026-08-10');
  });

  it('formats in Indonesian', () => {
    expect(formatDateLong('2026-08-10')).toBe('10 Agustus 2026');
    expect(formatDateShort('2026-08-10')).toContain('2026');
  });
});
