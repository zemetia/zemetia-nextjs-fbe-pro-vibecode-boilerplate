import { toUtcDateOnly } from '@/lib/date';
import { partnerOriginFromCountry } from '@/lib/partner';
import type { PartnerKypSubject } from '@/lib/partner-kyp';
import type { CreatePartnerInput, UpdatePartnerInput } from '@/lib/validations';

/**
 * Flattens a validated partner payload into the columns the row actually stores.
 * Create and update both go through it, so the mapping exists in exactly one
 * place and an edit can never write a column the other path leaves alone.
 *
 * There is no per-role column to clear any more, and no origin column either:
 * where a partner trades is read back from its country.
 */
export function toPartnerColumns(body: CreatePartnerInput | UpdatePartnerInput) {
  return {
    name: body.name,
    legalName: body.legal_name,
    type: body.type,

    isSupplier: body.is_supplier,
    isCustomer: body.is_customer,

    countryId: body.country_id,
    currencyCode: body.currency_code,

    email: body.email,
    phone: body.phone,
    website: body.website,

    contactName: body.contact_name,
    contactRole: body.contact_role,
    contactPhone: body.contact_phone,
    contactEmail: body.contact_email,
    contactCountryId: body.contact_country_id,
    contactIdType: body.contact_id_type,
    contactIdNumber: body.contact_id_number,

    addressLine: body.address_line,
    city: body.city,
    province: body.province,
    postalCode: body.postal_code,

    taxNumber: body.tax_number,
    nib: body.nib,
    foreignRegistrationNumber: body.foreign_registration_number,
    isPkp: body.is_pkp,
    sppkpNumber: body.sppkp_number,
    deedNumber: body.deed_number,
    // Tanggal akta adalah hari, bukan instan — dikirim `YYYY-MM-DD` dan ditulis
    // di tengah malam UTC, persis seperti tanggal dokumen lain (`@/lib/date`).
    deedDate: body.deed_date ? toUtcDateOnly(body.deed_date) : body.deed_date,
    ministryDecreeNumber: body.ministry_decree_number,

    purchaseTermDays: body.purchase_term_days,
    purchasePaymentMethod: body.purchase_payment_method,
    salesTermDays: body.sales_term_days,
    salesPaymentMethod: body.sales_payment_method,

    bankName: body.bank_name,
    bankAccountName: body.bank_account_name,
    bankAccountNo: body.bank_account_no,
    bankSwiftCode: body.bank_swift_code,

    notes: body.notes,
  };
}

/**
 * The KYP subject a *payload* makes — the state the row is about to be in.
 *
 * Verifikasi diperiksa sebelum tulisannya mendarat, bukan sesudah: kalau
 * suntingan ini membuat data KYP bolong, statusnya harus ikut turun dalam satu
 * transaksi yang sama. Memeriksanya setelah update berarti ada jeda saat centang
 * "Terverifikasi" duduk di atas data yang sudah tidak memenuhi syarat.
 */
export function toPartnerKypSubjectFromInput(
  body: CreatePartnerInput | UpdatePartnerInput,
  countryIso2: string,
): PartnerKypSubject {
  return {
    type: body.type,
    origin: partnerOriginFromCountry(countryIso2),
    legalName: body.legal_name ?? null,
    addressLine: body.address_line ?? null,
    city: body.city ?? null,
    province: body.province ?? null,
    postalCode: body.postal_code ?? null,
    contactName: body.contact_name ?? null,
    contactRole: body.contact_role ?? null,
    contactPhone: body.contact_phone ?? null,
    contactEmail: body.contact_email ?? null,
    contactCountryId: body.contact_country_id ?? null,
    contactIdType: body.contact_id_type ?? null,
    contactIdNumber: body.contact_id_number ?? null,
    taxNumber: body.tax_number ?? null,
    nib: body.nib ?? null,
    foreignRegistrationNumber: body.foreign_registration_number ?? null,
    isPkp: body.is_pkp,
    sppkpNumber: body.sppkp_number ?? null,
  };
}
