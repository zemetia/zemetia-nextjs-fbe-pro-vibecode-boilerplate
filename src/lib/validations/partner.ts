import { z } from 'zod';

import { NIB_LENGTH, NIK_LENGTH } from '@/lib/partner';
import { paginationSchema } from './common';

// Only identity fields are required — a clerk registering a new partner rarely
// has the NPWP or bank account on hand yet, and blocking the form on data they
// cannot know pushes them to invent placeholders.
// See docs/blueprint/ERROR_HANDLING.md: every rule names its own field.

const PARTNER_TYPES = ['COMPANY', 'INDIVIDUAL'] as const;

const PARTNER_ORIGINS = ['OVERSEAS', 'LOCAL'] as const;

const PAYMENT_METHODS = ['TRANSFER', 'CASH', 'LETTER_OF_CREDIT', 'CONSIGNMENT'] as const;

const CONTACT_ID_TYPES = ['NIK', 'PASSPORT', 'OTHER'] as const;

const VERIFICATION_STATES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
] as const;

export type PartnerTypeValue = (typeof PARTNER_TYPES)[number];
export type PartnerOriginValue = (typeof PARTNER_ORIGINS)[number];
export type PartnerPaymentMethodValue = (typeof PAYMENT_METHODS)[number];
export type PartnerContactIdTypeValue = (typeof CONTACT_ID_TYPES)[number];

/**
 * What an emptied optional field becomes. On create it is `undefined` (leave the
 * column at its default); on update it is `null` (the user cleared it on
 * purpose, so the stored value must go away — `undefined` would silently keep
 * the old one, since Prisma reads it as "no change").
 */
type Blank = null | undefined;

function optionalText<B extends Blank>(label: string, max: number, blank: B) {
  return z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .optional()
    .transform((value) => (value ? value : blank));
}

function optionalEmail<B extends Blank>(label: string, blank: B) {
  return z
    .union([z.literal(''), z.string().trim().email(`Format ${label} tidak valid`)])
    .optional()
    .transform((value) => (value ? value : blank));
}

function optionalWebsite<B extends Blank>(blank: B) {
  return z
    .union([z.literal(''), z.string().trim().url('Format website tidak valid')])
    .optional()
    .transform((value) => (value ? value : blank));
}

function optionalTerm<B extends Blank>(label: string, blank: B) {
  return z.coerce
    .number(`${label} tidak valid`)
    .int(`${label} harus berupa jumlah hari bulat`)
    .min(0, `${label} minimal 0 hari`)
    .max(365, `${label} maksimal 365 hari`)
    .nullish()
    .transform((value) => (value === null || value === undefined ? blank : value));
}

function optionalPaymentMethod<B extends Blank>(label: string, blank: B) {
  return z
    .enum(PAYMENT_METHODS, `${label} tidak dikenali`)
    .nullish()
    .transform((value) => (value ? value : blank));
}

function optionalContactIdType<B extends Blank>(blank: B) {
  return z
    .enum(CONTACT_ID_TYPES, 'Jenis identitas kontak tidak dikenali')
    .nullish()
    .transform((value) => (value ? value : blank));
}

/** `YYYY-MM-DD` — tanggal akta adalah hari, bukan instan (lihat `@/lib/date`). */
function optionalDateOnly<B extends Blank>(label: string, blank: B) {
  return z
    .union([
      z.literal(''),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} tidak valid`),
    ])
    .nullish()
    .transform((value) => (value ? value : blank));
}

function optionalBoolean(label: string) {
  return z
    .boolean(`${label} tidak valid`)
    .nullish()
    .transform((value) => value ?? false);
}

/**
 * One shape per wizard step, so the form can validate the visible step alone
 * (`partner*StepSchema` below) using the exact rules the API will re-apply.
 *
 * Asal mitra tidak ada di sini: ia diturunkan dari `country_id` (Indonesia =
 * lokal), jadi tidak ada yang perlu diisi maupun divalidasi.
 */
function identityShape<B extends Blank>(blank: B) {
  return {
    name: z
      .string('Nama mitra wajib diisi')
      .trim()
      .min(1, 'Nama mitra wajib diisi')
      .max(150, 'Nama mitra maksimal 150 karakter'),
    legal_name: optionalText('Nama legal', 200, blank),
    type: z.enum(PARTNER_TYPES, 'Tipe mitra wajib dipilih'),
    is_supplier: z.boolean('Peran supplier tidak valid').optional().transform((v) => v ?? false),
    is_customer: z.boolean('Peran customer tidak valid').optional().transform((v) => v ?? false),
    country_id: z.string('Negara wajib dipilih').min(1, 'Negara wajib dipilih'),
    currency_code: z.string('Mata uang wajib dipilih').min(1, 'Mata uang wajib dipilih'),
    email: optionalEmail('email operasional', blank),
    phone: optionalText('Telepon', 30, blank),
    website: optionalWebsite(blank),

    // Alamat perusahaan duduk di identitas, bukan di blok kontak: ia milik badan
    // usahanya (dicetak di PO, invoice, dan dokumen bea cukai), bukan milik orang
    // yang kebetulan jadi PIC-nya hari ini.
    address_line: optionalText('Alamat', 255, blank),
    city: optionalText('Kota', 100, blank),
    province: optionalText('Provinsi', 100, blank),
    postal_code: optionalText('Kode pos', 20, blank),
  };
}

function contactShape<B extends Blank>(blank: B) {
  return {
    contact_name: optionalText('Nama kontak', 100, blank),
    contact_role: optionalText('Jabatan kontak', 100, blank),
    contact_phone: optionalText('Telepon kontak', 30, blank),
    contact_email: optionalEmail('email kontak', blank),
    /** Kewarganegaraan orangnya — sumbu terpisah dari negara mitranya. */
    contact_country_id: optionalText('Kewarganegaraan kontak', 50, blank),
    contact_id_type: optionalContactIdType(blank),
    contact_id_number: optionalText('Nomor identitas kontak', 50, blank),
  };
}

/** Tax, payment terms and bank details — one step in the form. */
function financeShape<B extends Blank>(blank: B) {
  return {
    tax_number: optionalText('NPWP / Tax ID', 50, blank),
    nib: optionalText('NIB', 20, blank),
    foreign_registration_number: optionalText('Nomor registrasi perusahaan', 50, blank),
    is_pkp: optionalBoolean('Status PKP'),
    sppkp_number: optionalText('Nomor SPPKP', 50, blank),
    deed_number: optionalText('Nomor akta pendirian', 100, blank),
    deed_date: optionalDateOnly('Tanggal akta pendirian', blank),
    ministry_decree_number: optionalText('Nomor SK Kemenkumham', 100, blank),

    purchase_term_days: optionalTerm('Termin pembelian', blank),
    purchase_payment_method: optionalPaymentMethod('Metode pembayaran pembelian', blank),
    sales_term_days: optionalTerm('Termin penjualan', blank),
    sales_payment_method: optionalPaymentMethod('Metode pembayaran penjualan', blank),

    bank_name: optionalText('Nama bank', 100, blank),
    bank_account_name: optionalText('Nama pemilik rekening', 100, blank),
    bank_account_no: optionalText('Nomor rekening', 50, blank),
    bank_swift_code: optionalText('Kode SWIFT/BIC', 20, blank),
    notes: optionalText('Catatan', 1000, blank),
  };
}

interface RoleFields {
  is_supplier: boolean;
  is_customer: boolean;
}

/**
 * The rule that makes one table honest for two roles: a partner must hold at
 * least one. Postgres guarantees the same floor (`partners_role_check`), but a
 * check constraint surfaces as a database error rather than a message the clerk
 * can act on, so the boundary states it too.
 */
function withRoleRules<T extends z.ZodType<RoleFields>>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (!value.is_supplier && !value.is_customer) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mitra harus punya minimal satu peran — supplier, customer, atau keduanya.',
      });
    }
  });
}

interface ContactIdFields {
  contact_id_type: PartnerContactIdTypeValue | null | undefined;
  contact_id_number: string | null | undefined;
}

/**
 * Jenis identitas dan nomornya adalah satu fakta, jadi keduanya harus datang
 * bersama: nomor tanpa jenis tidak bisa diperiksa formatnya, jenis tanpa nomor
 * tidak menyebut siapa pun. Dan NIK punya panjang pasti — 16 digit — jadi salah
 * ketik satu angka ditolak di sini, bukan ditemukan setahun kemudian di berkas
 * KYP yang sudah terlanjur disetujui.
 */
function withContactIdRules<T extends z.ZodType<ContactIdFields>>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const number = value.contact_id_number?.trim() ?? '';

    if (number && !value.contact_id_type) {
      ctx.addIssue({
        code: 'custom',
        path: ['contact_id_type'],
        message: 'Jenis identitas kontak wajib dipilih bila nomornya diisi.',
      });
    }

    if (!number && value.contact_id_type) {
      ctx.addIssue({
        code: 'custom',
        path: ['contact_id_number'],
        message: 'Nomor identitas kontak wajib diisi bila jenisnya sudah dipilih.',
      });
    }

    if (value.contact_id_type === 'NIK' && number && !new RegExp(`^\\d{${NIK_LENGTH}}$`).test(number)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contact_id_number'],
        message: `NIK harus ${NIK_LENGTH} digit angka.`,
      });
    }
  });
}

interface LegalFields {
  nib: string | null | undefined;
  is_pkp: boolean;
  sppkp_number: string | null | undefined;
}

/**
 * NIB terbit dari OSS dengan panjang tetap, jadi bentuknya bisa diperiksa —
 * berbeda dari nomor registrasi luar negeri yang formatnya berlainan di tiap
 * yurisdiksi, dan karena itu memang dipisah ke kolomnya sendiri.
 *
 * Nomor SPPKP tidak diwajibkan di sini: mitra bisa saja baru mengaku PKP hari
 * ini dan nomornya menyusul. Yang menuntut keduanya lengkap adalah verifikasi
 * KYP (`partnerKypChecklist()`), bukan penyimpanan datanya.
 */
function withLegalRules<T extends z.ZodType<LegalFields>>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const nib = value.nib?.trim() ?? '';

    if (nib && !new RegExp(`^\\d{${NIB_LENGTH}}$`).test(nib)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nib'],
        message: `NIB harus ${NIB_LENGTH} digit angka.`,
      });
    }

    if (!value.is_pkp && (value.sppkp_number?.trim() ?? '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['sppkp_number'],
        message: 'Nomor SPPKP hanya berlaku untuk mitra berstatus PKP.',
      });
    }
  });
}

function partnerWritableShape<B extends Blank>(blank: B) {
  return {
    ...identityShape(blank),
    ...contactShape(blank),
    ...financeShape(blank),
  };
}

function withPartnerRules<B extends Blank>(blank: B) {
  return withLegalRules(withContactIdRules(withRoleRules(z.object(partnerWritableShape(blank)))));
}

export const createPartnerSchema = withPartnerRules(undefined);

/**
 * Edit re-sends the identity block rather than patching it. A partial payload
 * could switch a partner to customer-only without the server ever seeing both
 * flags together, and the cross-field rule above would have nothing to check.
 */
export const updatePartnerSchema = withPartnerRules(null);

// Client-side per-step validation — same rules the API re-applies on submit.
export const partnerIdentityStepSchema = withRoleRules(z.object(identityShape(undefined)));
export const partnerContactStepSchema = withContactIdRules(z.object(contactShape(undefined)));
export const partnerFinanceStepSchema = withLegalRules(z.object(financeShape(undefined)));

export const setPartnerStatusSchema = z.object({
  is_active: z.boolean('Status mitra tidak valid'),
});

/**
 * Pengajuan verifikasi tidak membawa data apa pun — yang dinilai adalah baris
 * yang sudah tersimpan, dan catatan pengaju tidak akan mengubah kelengkapannya.
 */
export const reviewPartnerVerificationSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT'], 'Keputusan verifikasi wajib dipilih'),
    note: optionalText('Catatan peninjau', 500, null),
  })
  .superRefine((value, ctx) => {
    // Menolak tanpa alasan meninggalkan mitra yang tidak tahu apa yang harus
    // diperbaiki — dan pengajuan berikutnya akan persis sama.
    if (value.decision === 'REJECT' && !value.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Alasan penolakan wajib diisi.',
      });
    }
  });

export const partnerListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  type: z.enum(PARTNER_TYPES, 'Tipe mitra tidak dikenali').optional(),
  /** `supplier` / `customer` — filters by role, not by origin. */
  role: z.enum(['supplier', 'customer'], 'Filter peran tidak dikenali').optional(),
  /** Diterjemahkan jadi kondisi negara di route — tidak ada kolom `origin`. */
  origin: z.enum(PARTNER_ORIGINS, 'Filter asal mitra tidak dikenali').optional(),
  country_id: z.string().trim().max(50, 'Filter negara tidak valid').optional(),
  /**
   * Termasuk `EXPIRED`, yang tidak punya nilai kolom — route menerjemahkannya
   * jadi "berstatus VERIFIED tapi masa berlakunya sudah lewat".
   */
  verification: z.enum(VERIFICATION_STATES, 'Filter verifikasi tidak dikenali').optional(),
  is_active: z
    .enum(['true', 'false'], 'Filter status tidak valid')
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type SetPartnerStatusInput = z.infer<typeof setPartnerStatusSchema>;
export type ReviewPartnerVerificationInput = z.infer<typeof reviewPartnerVerificationSchema>;
export type PartnerListQuery = z.infer<typeof partnerListQuerySchema>;
