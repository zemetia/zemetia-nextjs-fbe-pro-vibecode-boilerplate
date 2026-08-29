/**
 * Calendar-day helpers. A purchase date is a *day*, not an instant: it is stored
 * in `@db.Date` and shown as "10 Agustus 2026", so it must never be round-tripped
 * through `toISOString()` — in UTC+7 that turns local midnight into the previous
 * day, and the document silently changes date.
 *
 * The wire format is `YYYY-MM-DD`; the client reads/writes it with the local
 * getters below, and the server rebuilds it at UTC midnight.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local `Date` → `"2026-08-10"`, using the calendar the user is looking at. */
export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `"2026-08-10"` → local midnight of that day. `undefined` for anything else. */
export function fromDateOnly(value: string | null | undefined): Date | undefined {
  if (!value || !DATE_ONLY_PATTERN.test(value)) return undefined;

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * `"2026-08-10"` → UTC midnight — the value Prisma writes into a `@db.Date`
 * column. Server-side counterpart of `fromDateOnly`.
 */
export function toUtcDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** A `@db.Date` column read back out as `"2026-08-10"`, in UTC as it was stored. */
export function fromUtcDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** `"10 Agustus 2026"` — the long form used on buttons, detail pages and print. */
export function formatDateLong(date: Date | string): string {
  const parsed = typeof date === 'string' ? (fromDateOnly(date) ?? new Date(date)) : date;

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

/** `"10 Agu 2026"` — the compact form for table cells. */
export function formatDateShort(date: Date | string): string {
  const parsed = typeof date === 'string' ? (fromDateOnly(date) ?? new Date(date)) : date;

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

/** Today at local midnight — the default value of a purchase date field. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
