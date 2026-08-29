import type {
  PartnerContactIdType,
  PartnerOrigin,
  PartnerPaymentMethod,
  PartnerType,
  PartnerVerificationState,
} from '@/types/value-objects';

/**
 * Presentation labels for the partner enums, plus the small pure helpers the
 * forms and tables share. The database stores English identifiers (stable,
 * greppable, safe to reorder); everything on screen reads Indonesian and comes
 * from here — never from a per-component ternary.
 *
 * A partner has two independent axes. `type` is what it *is* (badan usaha or
 * perorangan); the role flags are what it *does for us*. Neither derives the
 * other: a scrap collector is often an individual on the buy side, and a
 * domestic retail customer is often an individual on the sell side.
 */

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  COMPANY: 'Badan Usaha',
  INDIVIDUAL: 'Perorangan',
};

export const PARTNER_TYPE_DESCRIPTIONS: Record<PartnerType, string> = {
  COMPANY: 'PT, CV, atau badan hukum luar negeri — punya NIB dan NPWP badan, kontaknya lewat PIC.',
  INDIVIDUAL: 'Orang perseorangan — cukup NIK atau NPWP pribadi, dia sendiri kontaknya.',
};

export const PARTNER_TYPES = ['COMPANY', 'INDIVIDUAL'] as const;

export const PARTNER_TYPE_OPTIONS = PARTNER_TYPES.map((value) => ({
  value,
  label: PARTNER_TYPE_LABELS[value],
}));

/** Badan usaha carries registration + trading-vs-legal name; perorangan does not. */
export function isCompanyType(type: PartnerType): boolean {
  return type === 'COMPANY';
}

/**
 * Asal mitra — satu kategori untuk kedua peran. Pertanyaannya sama dibaca dari
 * sisi beli maupun sisi jual (menyeberang batas negara atau tidak), dan hanya
 * itu yang mengubah dokumennya: mata uang asing, kurs, bea masuk, freight, PEB.
 *
 * **Diturunkan dari negara, tidak disimpan.** Negaranya sudah menjawab
 * pertanyaan yang sama, jadi kolom tersendiri hanya melahirkan jawaban kedua
 * yang bisa berselisih — mitra bernegara Singapura tapi bertanda "Lokal" akan
 * lolos ke dokumen yang salah tanpa ada apa pun di layar yang menjelaskannya.
 */
export const PARTNER_ORIGIN_LABELS: Record<PartnerOrigin, string> = {
  OVERSEAS: 'Overseas',
  LOCAL: 'Lokal',
};

export const PARTNER_ORIGINS = ['OVERSEAS', 'LOCAL'] as const;

export const PARTNER_ORIGIN_OPTIONS = PARTNER_ORIGINS.map((value) => ({
  value,
  label: PARTNER_ORIGIN_LABELS[value],
}));

export const PARTNER_PAYMENT_METHOD_LABELS: Record<PartnerPaymentMethod, string> = {
  TRANSFER: 'Transfer bank',
  CASH: 'Tunai',
  LETTER_OF_CREDIT: 'Letter of Credit (L/C)',
  CONSIGNMENT: 'Konsinyasi',
};

export const PARTNER_PAYMENT_METHOD_OPTIONS = (
  Object.keys(PARTNER_PAYMENT_METHOD_LABELS) as PartnerPaymentMethod[]
).map((value) => ({ value, label: PARTNER_PAYMENT_METHOD_LABELS[value] }));

/**
 * Identitas kontak person. Jenisnya ditanyakan, tidak diturunkan dari negara
 * mitra: perusahaan Dubai boleh menaruh PIC orang Indonesia (NIK), dan pabrik
 * Bekasi boleh dipegang ekspatriat (paspor).
 */
export const PARTNER_CONTACT_ID_TYPE_LABELS: Record<PartnerContactIdType, string> = {
  NIK: 'NIK (KTP)',
  PASSPORT: 'Paspor',
  OTHER: 'Identitas lain',
};

export const PARTNER_CONTACT_ID_TYPE_OPTIONS = (
  Object.keys(PARTNER_CONTACT_ID_TYPE_LABELS) as PartnerContactIdType[]
).map((value) => ({ value, label: PARTNER_CONTACT_ID_TYPE_LABELS[value] }));

/** NIK selalu 16 digit — satu-satunya identitas di sini yang formatnya pasti. */
export const NIK_LENGTH = 16;
/** NIB terbit dari OSS dengan panjang tetap 13 digit. */
export const NIB_LENGTH = 13;

export const PARTNER_VERIFICATION_STATE_LABELS: Record<PartnerVerificationState, string> = {
  UNVERIFIED: 'Belum terverifikasi',
  PENDING: 'Menunggu peninjauan',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Verifikasi ditolak',
  EXPIRED: 'Verifikasi kedaluwarsa',
};

export const PARTNER_VERIFICATION_STATES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
] as const;

export const PARTNER_VERIFICATION_STATE_OPTIONS = PARTNER_VERIFICATION_STATES.map((value) => ({
  value,
  label: PARTNER_VERIFICATION_STATE_LABELS[value],
}));

export interface PartnerRoles {
  isSupplier: boolean;
  isCustomer: boolean;
}

/** Badge text on the list — one partner, one cell, however many roles it holds. */
export function partnerRoleLabel(roles: PartnerRoles): string {
  if (roles.isSupplier && roles.isCustomer) return 'Supplier & Customer';
  if (roles.isSupplier) return 'Supplier';
  if (roles.isCustomer) return 'Customer';
  return '—';
}

/** Billed from abroad — drives the SWIFT/IBAN hint and the currency question. */
export function isOverseasOrigin(origin: PartnerOrigin): boolean {
  return origin === 'OVERSEAS';
}

/**
 * A local partner trades domestically in rupiah, so the form suggests the
 * currency instead of asking twice. Values are pinned here, not typed per form.
 */
export const LOCAL_COUNTRY_ISO2 = 'ID';
export const LOCAL_CURRENCY_CODE = 'IDR';

/**
 * The one derivation of a partner's origin: Indonesia is domestic, everything
 * else crosses a border. Pure and isomorphic — the form, the DTO and the
 * server-side document checks all call this, so none of them can disagree about
 * where a partner sits.
 */
export function partnerOriginFromCountry(iso2: string): PartnerOrigin {
  return iso2.toUpperCase() === LOCAL_COUNTRY_ISO2 ? 'LOCAL' : 'OVERSEAS';
}

/** `where` fragment for "this origin", expressed as the country condition. */
export function countryIso2FilterForOrigin(origin: PartnerOrigin) {
  return origin === 'LOCAL' ? LOCAL_COUNTRY_ISO2 : { not: LOCAL_COUNTRY_ISO2 };
}

export const PARTNER_CODE_PREFIX = 'MTR';
const PARTNER_CODE_DIGITS = 4;

/** `MTR-0001`. Padded to four digits, then grows naturally past 9999. */
export function formatPartnerCode(sequence: number): string {
  return `${PARTNER_CODE_PREFIX}-${String(sequence).padStart(PARTNER_CODE_DIGITS, '0')}`;
}

/** Reads the numeric tail back out of a code; `0` for anything unparseable. */
export function parsePartnerCodeSequence(code: string): number {
  const sequence = Number(code.slice(PARTNER_CODE_PREFIX.length + 1));
  return Number.isFinite(sequence) ? sequence : 0;
}
