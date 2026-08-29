/**
 * Chart-of-accounts code arithmetic — pure, no I/O, safe on both sides of the
 * wire (the form previews the next code with the same functions the API uses to
 * mint it).
 *
 * A code is one digit per tree level, right-padded with `0` up to four
 * characters, plus a fifth character for the deepest level:
 *
 * ```
 * 1000   level 1   segments [1]           ASET
 * 1100   level 2   segments [1,1]         ASET LANCAR
 * 1110   level 3   segments [1,1,1]       Kas
 * 1121   level 4   segments [1,1,2,1]     Bank BCA
 * 11213  level 5   segments [1,1,2,1,3]   Bank BSI
 * ```
 *
 * `0` is reserved as padding, so every segment is `1..9`: a node holds at most
 * 9 children and the tree is at most 5 levels deep. Because the padding keeps
 * every code at least four characters wide, plain lexicographic ordering is
 * already tree pre-order — `ORDER BY code` needs no companion sort key.
 */

/** Deepest level a code can address. */
export const ACCOUNT_MAX_LEVEL = 5;

/** Children one node can hold — the digits `1..9`, since `0` means padding. */
export const ACCOUNT_MAX_CHILDREN = 9;

/** Width a code is padded to; only level 5 exceeds it. */
export const ACCOUNT_CODE_PAD_LENGTH = 4;

const MIN_SEGMENT = 1;
const MAX_SEGMENT = ACCOUNT_MAX_CHILDREN;

/** Class digits in use: 1 Aset … 6 Di Luar Usaha. */
export const ACCOUNT_CLASS_DIGITS = [1, 2, 3, 4, 5, 6] as const;
export type AccountClassDigit = (typeof ACCOUNT_CLASS_DIGITS)[number];

/**
 * Splits a code into one segment per level, or returns `null` when the code
 * does not follow the scheme — a non-digit, a `0` that is not trailing padding,
 * or a length outside 4..5.
 */
export function parseAccountCode(code: string): number[] | null {
  if (!/^[1-9][0-9]{3,4}$/.test(code)) return null;

  const digits = [...code].map(Number);

  if (digits.length > ACCOUNT_CODE_PAD_LENGTH) {
    // Level 5 uses every character, so nothing may be padding.
    return digits.some((digit) => digit < MIN_SEGMENT) ? null : digits;
  }

  // Level 1..4: significant digits first, then a run of padding zeros.
  const significant = digits.findIndex((digit) => digit === 0);
  if (significant === -1) return digits;
  if (digits.slice(significant).some((digit) => digit !== 0)) return null;

  return digits.slice(0, significant);
}

export function isAccountCode(code: string): boolean {
  return parseAccountCode(code) !== null;
}

/** `1110` → 3, `11213` → 5. Returns `null` for a code off the scheme. */
export function accountCodeLevel(code: string): number | null {
  return parseAccountCode(code)?.length ?? null;
}

/**
 * Renders segments back into a code. Levels 1..4 pad with `0`; level 5 fills
 * all five characters.
 */
export function buildAccountCode(segments: readonly number[]): string {
  if (
    segments.length < 1 ||
    segments.length > ACCOUNT_MAX_LEVEL ||
    segments.some((segment) => !Number.isInteger(segment) || segment < MIN_SEGMENT || segment > MAX_SEGMENT)
  ) {
    throw new RangeError('Segmen kode akun di luar rentang yang diizinkan.');
  }

  return segments.join('').padEnd(ACCOUNT_CODE_PAD_LENGTH, '0');
}

/** Code of the node one level up, or `null` for a root (level 1). */
export function parentAccountCode(code: string): string | null {
  const segments = parseAccountCode(code);
  if (!segments || segments.length === 1) return null;
  return buildAccountCode(segments.slice(0, -1));
}

/** Child code for `ordinal` (1..9) under `parentCode`. */
export function childAccountCode(parentCode: string, ordinal: number): string {
  const segments = parseAccountCode(parentCode);
  if (!segments) throw new RangeError('Kode akun induk tidak dikenali.');
  if (segments.length >= ACCOUNT_MAX_LEVEL) {
    throw new RangeError('Akun induk sudah berada di level terdalam.');
  }
  return buildAccountCode([...segments, ordinal]);
}

/**
 * The part of a child's code the user may not touch — everything the parent
 * contributes. The form renders it as a locked prefix in front of the one
 * editable digit.
 */
export function childCodePrefix(parentCode: string): string {
  const segments = parseAccountCode(parentCode);
  if (!segments) throw new RangeError('Kode akun induk tidak dikenali.');
  return segments.join('');
}

/**
 * Trailing zeros a child code carries, so the form can show the full shape
 * (`112` + `1` + `0` = `1121`) while only the middle digit is editable.
 */
export function childCodePadding(parentCode: string): string {
  const level = (parseAccountCode(parentCode)?.length ?? 0) + 1;
  return '0'.repeat(Math.max(0, ACCOUNT_CODE_PAD_LENGTH - level));
}

export function canHaveChildren(code: string): boolean {
  const level = accountCodeLevel(code);
  return level !== null && level < ACCOUNT_MAX_LEVEL;
}

/**
 * Lowest free ordinal under a parent, or `null` when all 9 slots are taken.
 * `usedCodes` is the parent's existing children, in any order.
 */
export function nextChildOrdinal(parentCode: string, usedCodes: readonly string[]): number | null {
  const depth = parseAccountCode(parentCode)?.length;
  if (depth === undefined) return null;

  const taken = new Set(
    usedCodes.map((code) => parseAccountCode(code)?.[depth]).filter((segment) => segment !== undefined),
  );

  for (let ordinal = MIN_SEGMENT; ordinal <= MAX_SEGMENT; ordinal += 1) {
    if (!taken.has(ordinal)) return ordinal;
  }

  return null;
}

/** First digit — the account class. `null` when the code is off the scheme. */
export function accountClassDigit(code: string): number | null {
  return parseAccountCode(code)?.[0] ?? null;
}
