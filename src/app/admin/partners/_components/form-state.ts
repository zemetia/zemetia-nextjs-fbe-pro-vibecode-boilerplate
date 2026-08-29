import type { FieldErrors } from '@/hooks';
import type { PartnerWritePayload } from '@/services';
import type {
  PartnerContactIdType,
  PartnerDetailVO,
  PartnerPaymentMethod,
  PartnerType,
} from '@/types/value-objects';

/**
 * Wizard form state. Text fields are plain strings (an untouched field is `''`,
 * which the API turns into "no value"); the enums and the numeric terms stay
 * `undefined` until chosen so a combobox can render its placeholder.
 */
export interface PartnerFormState {
  name: string;
  legalName: string;
  type: PartnerType;
  isSupplier: boolean;
  isCustomer: boolean;
  /** Also decides the partner's origin: Indonesia = lokal, selain itu = overseas. */
  countryId: string;
  currencyCode: string;
  email: string;
  phone: string;
  website: string;
  /** Alamat perusahaan — bagian dari identitas badannya, bukan milik PIC-nya. */
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;

  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  /** Kewarganegaraan kontak — bisa berbeda dari negara mitranya. */
  contactCountryId: string;
  contactIdType: PartnerContactIdType | undefined;
  contactIdNumber: string;

  taxNumber: string;
  nib: string;
  foreignRegistrationNumber: string;
  isPkp: boolean;
  sppkpNumber: string;
  deedNumber: string;
  /** `YYYY-MM-DD`; `''` selama belum dipilih. */
  deedDate: string;
  ministryDecreeNumber: string;
  purchaseTermDays: number | undefined;
  purchasePaymentMethod: PartnerPaymentMethod | undefined;
  salesTermDays: number | undefined;
  salesPaymentMethod: PartnerPaymentMethod | undefined;
  bankName: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankSwiftCode: string;
  notes: string;
}

export const EMPTY_PARTNER_FORM: PartnerFormState = {
  name: '',
  legalName: '',
  type: 'COMPANY',
  isSupplier: false,
  isCustomer: false,
  countryId: '',
  currencyCode: '',
  email: '',
  phone: '',
  website: '',
  addressLine: '',
  city: '',
  province: '',
  postalCode: '',
  contactName: '',
  contactRole: '',
  contactPhone: '',
  contactEmail: '',
  contactCountryId: '',
  contactIdType: undefined,
  contactIdNumber: '',
  taxNumber: '',
  nib: '',
  foreignRegistrationNumber: '',
  isPkp: false,
  sppkpNumber: '',
  deedNumber: '',
  deedDate: '',
  ministryDecreeNumber: '',
  purchaseTermDays: undefined,
  purchasePaymentMethod: undefined,
  salesTermDays: undefined,
  salesPaymentMethod: undefined,
  bankName: '',
  bankAccountName: '',
  bankAccountNo: '',
  bankSwiftCode: '',
  notes: '',
};

/** Detail VO → form state. The VO renders "—" for blanks; the form needs `''`. */
export function toFormState(partner: PartnerDetailVO): PartnerFormState {
  const value = (input: string): string => (input === '—' ? '' : input);

  return {
    name: partner.name,
    legalName: value(partner.legalName),
    type: partner.type,
    isSupplier: partner.isSupplier,
    isCustomer: partner.isCustomer,
    countryId: partner.countryId,
    currencyCode: partner.currencyCode,
    email: value(partner.email),
    phone: value(partner.phone),
    website: value(partner.website),
    addressLine: value(partner.addressLine),
    city: value(partner.city),
    province: value(partner.province),
    postalCode: value(partner.postalCode),
    contactName: value(partner.contactName),
    contactRole: value(partner.contactRole),
    contactPhone: value(partner.contactPhone),
    contactEmail: value(partner.contactEmail),
    contactCountryId: partner.contactCountryId ?? '',
    contactIdType: partner.contactIdType,
    contactIdNumber: value(partner.contactIdNumber),
    taxNumber: value(partner.taxNumber),
    nib: value(partner.nib),
    foreignRegistrationNumber: value(partner.foreignRegistrationNumber),
    isPkp: partner.isPkp,
    sppkpNumber: value(partner.sppkpNumber),
    deedNumber: value(partner.deedNumber),
    deedDate: partner.deedDate ?? '',
    ministryDecreeNumber: value(partner.ministryDecreeNumber),
    purchaseTermDays: partner.purchaseTermDays,
    purchasePaymentMethod: partner.purchasePaymentMethod,
    salesTermDays: partner.salesTermDays,
    salesPaymentMethod: partner.salesPaymentMethod,
    bankName: value(partner.bankName),
    bankAccountName: value(partner.bankAccountName),
    bankAccountNo: value(partner.bankAccountNo),
    bankSwiftCode: value(partner.bankSwiftCode),
    notes: value(partner.notes),
  };
}

/**
 * Form state → API body. Emptied fields are sent explicitly (`''` / `null`)
 * rather than omitted, so editing a partner can actually clear a value.
 */
export function toPayload(form: PartnerFormState): PartnerWritePayload {
  return {
    name: form.name,
    legal_name: form.legalName,
    type: form.type,
    is_supplier: form.isSupplier,
    is_customer: form.isCustomer,
    country_id: form.countryId,
    currency_code: form.currencyCode,
    email: form.email,
    phone: form.phone,
    website: form.website,
    address_line: form.addressLine,
    city: form.city,
    province: form.province,
    postal_code: form.postalCode,
    contact_name: form.contactName,
    contact_role: form.contactRole,
    contact_phone: form.contactPhone,
    contact_email: form.contactEmail,
    contact_country_id: form.contactCountryId,
    contact_id_type: form.contactIdType ?? null,
    contact_id_number: form.contactIdNumber,
    tax_number: form.taxNumber,
    nib: form.nib,
    foreign_registration_number: form.foreignRegistrationNumber,
    is_pkp: form.isPkp,
    sppkp_number: form.sppkpNumber,
    deed_number: form.deedNumber,
    deed_date: form.deedDate,
    ministry_decree_number: form.ministryDecreeNumber,
    purchase_term_days: form.purchaseTermDays ?? null,
    purchase_payment_method: form.purchasePaymentMethod ?? null,
    sales_term_days: form.salesTermDays ?? null,
    sales_payment_method: form.salesPaymentMethod ?? null,
    bank_name: form.bankName,
    bank_account_name: form.bankAccountName,
    bank_account_no: form.bankAccountNo,
    bank_swift_code: form.bankSwiftCode,
    notes: form.notes,
  };
}

/** Step payloads for client-side validation — same snake_case keys as the API. */
export function identityInput(form: PartnerFormState) {
  return {
    name: form.name,
    legal_name: form.legalName,
    type: form.type,
    is_supplier: form.isSupplier,
    is_customer: form.isCustomer,
    country_id: form.countryId,
    currency_code: form.currencyCode,
    email: form.email,
    phone: form.phone,
    website: form.website,
    address_line: form.addressLine,
    city: form.city,
    province: form.province,
    postal_code: form.postalCode,
  };
}

export function contactInput(form: PartnerFormState) {
  return {
    contact_name: form.contactName,
    contact_role: form.contactRole,
    contact_phone: form.contactPhone,
    contact_email: form.contactEmail,
    contact_country_id: form.contactCountryId,
    contact_id_type: form.contactIdType,
    contact_id_number: form.contactIdNumber,
  };
}

export function financeInput(form: PartnerFormState) {
  return {
    tax_number: form.taxNumber,
    nib: form.nib,
    foreign_registration_number: form.foreignRegistrationNumber,
    is_pkp: form.isPkp,
    sppkp_number: form.sppkpNumber,
    deed_number: form.deedNumber,
    deed_date: form.deedDate,
    ministry_decree_number: form.ministryDecreeNumber,
    purchase_term_days: form.purchaseTermDays,
    purchase_payment_method: form.purchasePaymentMethod,
    sales_term_days: form.salesTermDays,
    sales_payment_method: form.salesPaymentMethod,
    bank_name: form.bankName,
    bank_account_name: form.bankAccountName,
    bank_account_no: form.bankAccountNo,
    bank_swift_code: form.bankSwiftCode,
    notes: form.notes,
  };
}

/** Maps API field keys back onto the form fields, for per-field error display. */
export type PartnerFieldErrors = FieldErrors;
