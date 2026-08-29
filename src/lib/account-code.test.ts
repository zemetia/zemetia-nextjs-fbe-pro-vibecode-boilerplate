import { describe, expect, it } from 'vitest';

import {
  accountCodeLevel,
  buildAccountCode,
  canHaveChildren,
  childAccountCode,
  childCodePadding,
  childCodePrefix,
  isAccountCode,
  nextChildOrdinal,
  parentAccountCode,
  parseAccountCode,
} from './account-code';

describe('parseAccountCode', () => {
  it('reads one segment per level, ignoring trailing padding', () => {
    expect(parseAccountCode('1000')).toEqual([1]);
    expect(parseAccountCode('1100')).toEqual([1, 1]);
    expect(parseAccountCode('1110')).toEqual([1, 1, 1]);
    expect(parseAccountCode('1121')).toEqual([1, 1, 2, 1]);
    expect(parseAccountCode('11213')).toEqual([1, 1, 2, 1, 3]);
  });

  it('rejects a zero that is not padding — it would name a level with no parent', () => {
    expect(parseAccountCode('1101')).toBeNull();
    expect(parseAccountCode('11203')).toBeNull();
  });

  it('rejects anything off the scheme', () => {
    expect(parseAccountCode('0100')).toBeNull();
    expect(parseAccountCode('110')).toBeNull();
    expect(parseAccountCode('112134')).toBeNull();
    expect(parseAccountCode('11a3')).toBeNull();
    expect(isAccountCode('1121')).toBe(true);
  });
});

describe('accountCodeLevel', () => {
  it('counts significant digits', () => {
    expect(accountCodeLevel('1000')).toBe(1);
    expect(accountCodeLevel('1110')).toBe(3);
    expect(accountCodeLevel('11213')).toBe(5);
    expect(accountCodeLevel('1101')).toBeNull();
  });
});

describe('buildAccountCode', () => {
  it('pads levels 1..4 and fills level 5', () => {
    expect(buildAccountCode([1])).toBe('1000');
    expect(buildAccountCode([1, 1, 2])).toBe('1120');
    expect(buildAccountCode([1, 1, 2, 1, 3])).toBe('11213');
  });

  it('refuses a segment outside 1..9', () => {
    expect(() => buildAccountCode([1, 0])).toThrow();
    expect(() => buildAccountCode([1, 1, 1, 1, 1, 1])).toThrow();
  });
});

describe('childAccountCode', () => {
  it('appends the ordinal at the next level', () => {
    expect(childAccountCode('1000', 1)).toBe('1100');
    expect(childAccountCode('1120', 1)).toBe('1121');
    expect(childAccountCode('1121', 3)).toBe('11213');
  });

  it('stops at the deepest level', () => {
    expect(canHaveChildren('1121')).toBe(true);
    expect(canHaveChildren('11213')).toBe(false);
    expect(() => childAccountCode('11213', 1)).toThrow();
  });

  it('exposes the locked prefix and the padding around the editable digit', () => {
    // Parent 1100 is level 2, so its child is level 3: `11` + digit + one pad.
    expect(childCodePrefix('1100')).toBe('11');
    expect(childCodePadding('1100')).toBe('0');
    // A level-4 child fills the width, and a level-5 one grows past it.
    expect(childCodePadding('1120')).toBe('');
    expect(childCodePrefix('1121')).toBe('1121');
    expect(childCodePadding('1121')).toBe('');
  });
});

describe('parentAccountCode', () => {
  it('walks one level up, and stops at a root', () => {
    expect(parentAccountCode('11213')).toBe('1121');
    expect(parentAccountCode('1121')).toBe('1120');
    expect(parentAccountCode('1100')).toBe('1000');
    expect(parentAccountCode('1000')).toBeNull();
  });
});

describe('nextChildOrdinal', () => {
  it('takes the lowest free slot', () => {
    expect(nextChildOrdinal('1120', ['1121', '1122'])).toBe(3);
    expect(nextChildOrdinal('1120', ['1122'])).toBe(1);
    expect(nextChildOrdinal('1120', [])).toBe(1);
  });

  it('returns null when all nine are taken', () => {
    const full = Array.from({ length: 9 }, (_, index) => `112${index + 1}`);
    expect(nextChildOrdinal('1120', full)).toBeNull();
  });

  it('reads the slot at the child depth, not the last character', () => {
    expect(nextChildOrdinal('1000', ['1100', '1200', '1300'])).toBe(4);
  });
});
