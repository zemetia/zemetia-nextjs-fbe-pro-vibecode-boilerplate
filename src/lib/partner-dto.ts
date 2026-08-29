import type { Country, Currency, Partner, User } from '@prisma/client';

import { fromUtcDateOnly } from '@/lib/date';
import { partnerKypChecklist, type PartnerKypSubject } from '@/lib/partner-kyp';
import { partnerOriginFromCountry } from '@/lib/partner';
import {
  canRequestPartnerVerification,
  daysUntilPartnerExpiry,
  isPartnerVerified,
  partnerVerificationState,
} from '@/lib/partner-verification';
import type { PartnerDetailDTO, PartnerDTO, PartnerVerificationDTO } from '@/types/dtos';

/**
 * The relation columns every partner response carries. Keep the route handlers
 * reading from one include so the list row and the detail row can never drift
 * apart.
 *
 * Kewarganegaraan kontak dan dua nama peninjau ikut di sini karena kartu
 * verifikasi menyebut orangnya, bukan idnya — dan id pengguna termasuk hal yang
 * tidak boleh muncul di layar (ERROR_HANDLING.md).
 */
export const PARTNER_INCLUDE = {
  country: { select: { id: true, name: true, iso2: true } },
  contactCountry: { select: { id: true, name: true, iso2: true } },
  currency: { select: { code: true, symbol: true } },
  verificationRequestedBy: { select: { name: true, email: true } },
  verificationReviewedBy: { select: { name: true, email: true } },
} as const;

type PartnerActor = Pick<User, 'name' | 'email'> | null;

export type PartnerRow = Partner & {
  country: Pick<Country, 'id' | 'name' | 'iso2'>;
  contactCountry: Pick<Country, 'id' | 'name' | 'iso2'> | null;
  currency: Pick<Currency, 'code' | 'symbol'>;
  verificationRequestedBy: PartnerActor;
  verificationReviewedBy: PartnerActor;
};

/** Nama pengguna, jatuh ke emailnya bila akun lama belum punya nama. */
function actorName(actor: PartnerActor): string | null {
  if (!actor) return null;
  return actor.name ?? actor.email;
}

/**
 * The KYP subject a partner row makes: the same shape the wizard would produce,
 * so the checklist rule itself lives in exactly one place.
 */
export function toPartnerKypSubject(row: PartnerRow): PartnerKypSubject {
  return {
    type: row.type,
    origin: partnerOriginFromCountry(row.country.iso2),
    legalName: row.legalName,
    addressLine: row.addressLine,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    contactName: row.contactName,
    contactRole: row.contactRole,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    contactCountryId: row.contactCountryId,
    contactIdType: row.contactIdType,
    contactIdNumber: row.contactIdNumber,
    taxNumber: row.taxNumber,
    nib: row.nib,
    foreignRegistrationNumber: row.foreignRegistrationNumber,
    isPkp: row.isPkp,
    sppkpNumber: row.sppkpNumber,
  };
}

function toVerificationDTO(row: PartnerRow): PartnerVerificationDTO {
  const state = partnerVerificationState(row.verificationStatus, row.verifiedUntil);
  const checklist = partnerKypChecklist(toPartnerKypSubject(row));

  return {
    status: row.verificationStatus,
    state,
    is_verified: isPartnerVerified(state),
    // Dua syarat, dan keduanya dijawab di sini supaya layar tidak menyusun
    // aturannya sendiri: statusnya memang boleh diajukan, dan datanya lengkap.
    can_request: canRequestPartnerVerification(state) && checklist.isComplete,
    requested_at: row.verificationRequestedAt?.toISOString() ?? null,
    requested_by: actorName(row.verificationRequestedBy),
    reviewed_at: row.verificationReviewedAt?.toISOString() ?? null,
    reviewed_by: actorName(row.verificationReviewedBy),
    verified_at: row.verifiedAt?.toISOString() ?? null,
    verified_until: row.verifiedUntil?.toISOString() ?? null,
    days_until_expiry: row.verifiedUntil ? daysUntilPartnerExpiry(row.verifiedUntil) : null,
    note: row.verificationNote,
    kyp: {
      is_complete: checklist.isComplete,
      filled_count: checklist.filledCount,
      total_count: checklist.totalCount,
      missing: checklist.missing.map((item) => ({
        key: item.key,
        label: item.label,
        section: item.section,
      })),
    },
  };
}

export function toPartnerDTO(row: PartnerRow): PartnerDTO {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    is_supplier: row.isSupplier,
    is_customer: row.isCustomer,
    // Derived, never stored — the country already answers it.
    origin: partnerOriginFromCountry(row.country.iso2),
    country: { id: row.country.id, name: row.country.name, iso2: row.country.iso2 },
    currency: { code: row.currency.code, symbol: row.currency.symbol },
    email: row.email,
    phone: row.phone,
    city: row.city,
    // Sama seperti origin: dihitung saat dibaca, bukan disimpan.
    verification_state: partnerVerificationState(row.verificationStatus, row.verifiedUntil),
    verified_until: row.verifiedUntil?.toISOString() ?? null,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
  };
}

export function toPartnerDetailDTO(row: PartnerRow): PartnerDetailDTO {
  return {
    ...toPartnerDTO(row),
    legal_name: row.legalName,
    website: row.website,
    contact_name: row.contactName,
    contact_role: row.contactRole,
    contact_phone: row.contactPhone,
    contact_email: row.contactEmail,
    contact_country: row.contactCountry
      ? {
          id: row.contactCountry.id,
          name: row.contactCountry.name,
          iso2: row.contactCountry.iso2,
        }
      : null,
    contact_id_type: row.contactIdType,
    contact_id_number: row.contactIdNumber,
    address_line: row.addressLine,
    province: row.province,
    postal_code: row.postalCode,
    tax_number: row.taxNumber,
    nib: row.nib,
    foreign_registration_number: row.foreignRegistrationNumber,
    is_pkp: row.isPkp,
    sppkp_number: row.sppkpNumber,
    deed_number: row.deedNumber,
    deed_date: row.deedDate ? fromUtcDateOnly(row.deedDate) : null,
    ministry_decree_number: row.ministryDecreeNumber,
    verification: toVerificationDTO(row),
    purchase_term_days: row.purchaseTermDays,
    purchase_payment_method: row.purchasePaymentMethod,
    sales_term_days: row.salesTermDays,
    sales_payment_method: row.salesPaymentMethod,
    bank_name: row.bankName,
    bank_account_name: row.bankAccountName,
    bank_account_no: row.bankAccountNo,
    bank_swift_code: row.bankSwiftCode,
    notes: row.notes,
    updated_at: row.updatedAt.toISOString(),
  };
}
