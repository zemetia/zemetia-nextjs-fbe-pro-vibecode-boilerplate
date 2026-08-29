import type { PaginatedDTO } from './pagination.dto';

export type PartnerTypeDTO = 'COMPANY' | 'INDIVIDUAL';

/**
 * Asal mitra — satu kategori untuk kedua peran. Menyeberang batas negara atau
 * tidak adalah satu-satunya sumbu yang mengubah dokumen dan angkanya.
 */
export type PartnerOriginDTO = 'OVERSEAS' | 'LOCAL';

export type PartnerPaymentMethodDTO = 'TRANSFER' | 'CASH' | 'LETTER_OF_CREDIT' | 'CONSIGNMENT';

/** Identitas orang yang jadi kontak — WNI membawa NIK, selainnya paspor. */
export type PartnerContactIdTypeDTO = 'NIK' | 'PASSPORT' | 'OTHER';

/** Yang tersimpan di kolom: keputusan yang pernah diambil seseorang. */
export type PartnerVerificationStatusDTO = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * Yang tampil di layar. `EXPIRED` tidak pernah disimpan — ia diturunkan dari
 * `verified_until` saat dibaca, jadi tidak ada cron yang bisa gagal dan
 * meninggalkan centang di atas data yang sudah wajib diperbarui.
 */
export type PartnerVerificationStateDTO = PartnerVerificationStatusDTO | 'EXPIRED';

export interface PartnerKypItemDTO {
  key: string;
  label: string;
  section: 'identity' | 'contact' | 'legal';
}

/**
 * Verifikasi KYP satu mitra, lengkap dengan alasan kenapa tombolnya boleh atau
 * tidak boleh ditekan — kelengkapannya dihitung server supaya layar dan API
 * tidak mungkin berbeda pendapat soal apa yang masih kurang.
 */
export interface PartnerVerificationDTO {
  status: PartnerVerificationStatusDTO;
  state: PartnerVerificationStateDTO;
  is_verified: boolean;
  can_request: boolean;
  requested_at: string | null;
  requested_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  verified_at: string | null;
  verified_until: string | null;
  /** Negatif bila sudah lewat; `null` bila belum pernah terverifikasi. */
  days_until_expiry: number | null;
  /** Alasan penolakan atau catatan penyetuju. */
  note: string | null;
  kyp: {
    is_complete: boolean;
    filled_count: number;
    total_count: number;
    missing: PartnerKypItemDTO[];
  };
}

/**
 * Row shape for the list table — the heavy fields live on `PartnerDetailDTO`.
 *
 * `origin` is never null: it describes the partner, not one of its roles, so it
 * is answerable the moment the row exists.
 */
export interface PartnerDTO {
  id: string;
  code: string;
  name: string;
  type: PartnerTypeDTO;
  is_supplier: boolean;
  is_customer: boolean;
  origin: PartnerOriginDTO;
  country: { id: string; name: string; iso2: string };
  currency: { code: string; symbol: string };
  email: string | null;
  phone: string | null;
  city: string | null;
  /** Cukup dua kolom untuk badge di daftar — sisanya hanya dibutuhkan detail. */
  verification_state: PartnerVerificationStateDTO;
  verified_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PartnerDetailDTO extends PartnerDTO {
  legal_name: string | null;
  website: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  /** Kewarganegaraan kontak — bisa berbeda dari negara mitranya. */
  contact_country: { id: string; name: string; iso2: string } | null;
  contact_id_type: PartnerContactIdTypeDTO | null;
  contact_id_number: string | null;
  address_line: string | null;
  province: string | null;
  postal_code: string | null;
  tax_number: string | null;
  nib: string | null;
  foreign_registration_number: string | null;
  is_pkp: boolean;
  sppkp_number: string | null;
  deed_number: string | null;
  /** `YYYY-MM-DD` — tanggal akta adalah hari, bukan instan. */
  deed_date: string | null;
  ministry_decree_number: string | null;
  verification: PartnerVerificationDTO;
  purchase_term_days: number | null;
  purchase_payment_method: PartnerPaymentMethodDTO | null;
  sales_term_days: number | null;
  sales_payment_method: PartnerPaymentMethodDTO | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_swift_code: string | null;
  notes: string | null;
  updated_at: string;
}

export type PartnerListDTO = PaginatedDTO<PartnerDTO>;
