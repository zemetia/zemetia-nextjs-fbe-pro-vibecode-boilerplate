import type {
  PartnerContactIdType,
  PartnerOrigin,
  PartnerType,
} from '@/types/value-objects';

/**
 * KYP — Know Your Partner. Daftar periksa kelengkapan data mitra, dan satu-satunya
 * penentu boleh tidaknya verifikasi **diajukan**.
 *
 * Dua hal yang sengaja dipisah:
 *
 * 1. **Lengkap ≠ terverifikasi.** Kelengkapan hanya syarat masuk; keputusannya
 *    tetap di tangan pemegang `partners:review-verification`. Kalau kelengkapan
 *    langsung memasang centang, "verifikasi" hanya akan berarti "formnya penuh",
 *    dan tidak ada seorang pun yang bertanggung jawab atas isinya.
 *
 * 2. **Aturannya satu, pemakainya dua.** Fungsi ini murni dan isomorfik: route
 *    handler memakainya untuk menolak pengajuan atas data bolong, layar memakainya
 *    untuk menyebut *apa* yang masih kosong. Tombol yang menyala padahal server
 *    akan menolak (atau sebaliknya) adalah hal yang paling mudah terjadi kalau
 *    aturannya ditulis dua kali.
 *
 * Data bank sengaja **tidak** ikut dinilai: verifikasi menjawab "mitranya nyata
 * dan kita tahu siapa dia", bukan "ke mana uangnya ditransfer" — rekening bisa
 * berubah kapan saja tanpa mengubah apa pun tentang identitasnya.
 */

export type PartnerKypSection = 'identity' | 'contact' | 'legal';

export const PARTNER_KYP_SECTION_LABELS: Record<PartnerKypSection, string> = {
  identity: 'Identitas & Alamat',
  contact: 'Kontak Person',
  legal: 'Pajak & Legal',
};

export interface PartnerKypItem {
  key: string;
  label: string;
  section: PartnerKypSection;
  filled: boolean;
}

export interface PartnerKypChecklist {
  items: PartnerKypItem[];
  /** Yang belum terisi — ini yang disebut layar dan pesan error. */
  missing: PartnerKypItem[];
  isComplete: boolean;
  filledCount: number;
  totalCount: number;
}

/**
 * Bentuk netral yang dinilai: kolom Prisma dan VO layar sama-sama bisa dipetakan
 * ke sini tanpa satu pun aturan ikut tersalin.
 */
export interface PartnerKypSubject {
  type: PartnerType;
  /** Diturunkan dari negaranya — menentukan NIB (lokal) vs registrasi asing. */
  origin: PartnerOrigin;

  legalName: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;

  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactCountryId: string | null;
  contactIdType: PartnerContactIdType | null;
  contactIdNumber: string | null;

  taxNumber: string | null;
  nib: string | null;
  foreignRegistrationNumber: string | null;
  isPkp: boolean;
  sppkpNumber: string | null;
}

/** VO layar menulis "—" untuk kosong; kolom Prisma menulis `null`. Keduanya kosong. */
function filled(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== '—';
}

export function partnerKypChecklist(subject: PartnerKypSubject): PartnerKypChecklist {
  const isCompany = subject.type === 'COMPANY';
  const isLocal = subject.origin === 'LOCAL';

  const items: PartnerKypItem[] = [
    // Badan usaha berdiri atas nama legalnya; perorangan tidak punya nama kedua,
    // jadi memintanya hanya akan melahirkan salinan nama yang sama.
    ...(isCompany
      ? [{ key: 'legal_name', label: 'Nama legal', section: 'identity' as const, filled: filled(subject.legalName) }]
      : []),
    { key: 'address_line', label: 'Alamat perusahaan', section: 'identity', filled: filled(subject.addressLine) },
    { key: 'city', label: 'Kota', section: 'identity', filled: filled(subject.city) },
    { key: 'province', label: 'Provinsi / state', section: 'identity', filled: filled(subject.province) },
    { key: 'postal_code', label: 'Kode pos', section: 'identity', filled: filled(subject.postalCode) },

    { key: 'contact_name', label: 'Nama kontak', section: 'contact', filled: filled(subject.contactName) },
    { key: 'contact_role', label: 'Jabatan kontak', section: 'contact', filled: filled(subject.contactRole) },
    { key: 'contact_phone', label: 'Telepon kontak', section: 'contact', filled: filled(subject.contactPhone) },
    { key: 'contact_email', label: 'Email kontak', section: 'contact', filled: filled(subject.contactEmail) },
    {
      key: 'contact_country_id',
      label: 'Kewarganegaraan kontak',
      section: 'contact',
      filled: filled(subject.contactCountryId),
    },
    {
      // Jenis dan nomornya satu baris periksa: nomor tanpa jenis tidak bisa
      // diperiksa formatnya, jenis tanpa nomor tidak menyebut siapa pun.
      key: 'contact_id_number',
      label: 'Nomor identitas kontak (NIK / paspor)',
      section: 'contact',
      filled: subject.contactIdType !== null && filled(subject.contactIdNumber),
    },

    {
      key: 'tax_number',
      label: isLocal ? 'NPWP' : 'Tax ID / VAT number',
      section: 'legal',
      filled: filled(subject.taxNumber),
    },
    // Badan usaha wajib punya nomor pendaftaran usaha — NIB di Indonesia,
    // padanannya di yurisdiksi lain. Perorangan tidak punya keduanya.
    ...(isCompany && isLocal
      ? [{ key: 'nib', label: 'NIB', section: 'legal' as const, filled: filled(subject.nib) }]
      : []),
    ...(isCompany && !isLocal
      ? [
          {
            key: 'foreign_registration_number',
            label: 'Nomor registrasi perusahaan',
            section: 'legal' as const,
            filled: filled(subject.foreignRegistrationNumber),
          },
        ]
      : []),
    // Hanya ditanyakan pada yang mengaku PKP: bagi non-PKP, nomor SPPKP memang
    // tidak ada, dan memintanya akan membuat kelengkapan mustahil dicapai.
    ...(subject.isPkp
      ? [
          {
            key: 'sppkp_number',
            label: 'Nomor SPPKP',
            section: 'legal' as const,
            filled: filled(subject.sppkpNumber),
          },
        ]
      : []),
  ];

  const missing = items.filter((item) => !item.filled);

  return {
    items,
    missing,
    isComplete: missing.length === 0,
    filledCount: items.length - missing.length,
    totalCount: items.length,
  };
}
