import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatNumber } from '@/lib/number';
import { formatDateLong, formatDateShort } from '@/lib/date';
import {
  PARTNER_CONTACT_ID_TYPE_LABELS,
  PARTNER_ORIGIN_LABELS,
  PARTNER_PAYMENT_METHOD_LABELS,
  PARTNER_TYPE_LABELS,
  PARTNER_VERIFICATION_STATE_LABELS,
  isOverseasOrigin,
  partnerRoleLabel,
} from '@/lib/partner';
import { PARTNER_KYP_SECTION_LABELS } from '@/lib/partner-kyp';
import { PARTNER_VERIFICATION_WARNING_DAYS } from '@/lib/partner-verification';
import type {
  PartnerDetailDTO,
  PartnerDTO,
  PartnerListDTO,
  PartnerVerificationDTO,
} from '@/types/dtos';
import type {
  PartnerDetailVO,
  PartnerListVO,
  PartnerOrigin,
  PartnerType,
  PartnerVerificationState,
  PartnerVerificationVO,
  PartnerVO,
} from '@/types/value-objects';

/** Optional text fields render as an em dash, never as an empty cell. */
const EMPTY = '—';

function text(value: string | null): string {
  return value ?? EMPTY;
}

function toVO(dto: PartnerDTO): PartnerVO {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    type: dto.type,
    typeLabel: PARTNER_TYPE_LABELS[dto.type],
    isSupplier: dto.is_supplier,
    isCustomer: dto.is_customer,
    roleLabel: partnerRoleLabel({ isSupplier: dto.is_supplier, isCustomer: dto.is_customer }),
    origin: dto.origin,
    originLabel: PARTNER_ORIGIN_LABELS[dto.origin],
    isOverseas: isOverseasOrigin(dto.origin),
    countryId: dto.country.id,
    countryName: dto.country.name,
    countryIso2: dto.country.iso2,
    currencyCode: dto.currency.code,
    currencySymbol: dto.currency.symbol,
    email: text(dto.email),
    phone: text(dto.phone),
    city: text(dto.city),
    verificationState: dto.verification_state,
    verificationStateLabel: PARTNER_VERIFICATION_STATE_LABELS[dto.verification_state],
    // Kedaluwarsa bukan terverifikasi — badge centang hanya menyala untuk yang
    // masa berlakunya masih jalan.
    isVerified: dto.verification_state === 'VERIFIED',
    isActive: dto.is_active,
    statusLabel: dto.is_active ? 'Aktif' : 'Nonaktif',
    createdAt: dto.created_at,
    createdAtLabel: formatDateShort(dto.created_at),
  };
}

function termLabel(days: number | null): string {
  if (days === null) return EMPTY;
  if (days === 0) return 'Bayar di muka';
  return `${formatNumber(days)} hari`;
}

/** Tanggal-waktu verifikasi tampil sebagai hari — jamnya tidak pernah berarti. */
function dateLabel(value: string | null): string {
  return value ? formatDateLong(value) : EMPTY;
}

function toVerificationVO(dto: PartnerVerificationDTO): PartnerVerificationVO {
  const state: PartnerVerificationState = dto.state;
  const days = dto.days_until_expiry;

  return {
    status: dto.status,
    state,
    stateLabel: PARTNER_VERIFICATION_STATE_LABELS[state],
    isVerified: dto.is_verified,
    canRequest: dto.can_request,
    requestedByLabel: text(dto.requested_by),
    requestedAtLabel: dateLabel(dto.requested_at),
    reviewedByLabel: text(dto.reviewed_by),
    reviewedAtLabel: dateLabel(dto.reviewed_at),
    verifiedAtLabel: dateLabel(dto.verified_at),
    verifiedUntilLabel: dateLabel(dto.verified_until),
    daysUntilExpiry: days ?? undefined,
    isExpiringSoon:
      dto.is_verified && days !== null && days <= PARTNER_VERIFICATION_WARNING_DAYS,
    note: text(dto.note),
    kyp: {
      isComplete: dto.kyp.is_complete,
      filledCount: dto.kyp.filled_count,
      totalCount: dto.kyp.total_count,
      progressLabel: `${formatNumber(dto.kyp.filled_count)} dari ${formatNumber(dto.kyp.total_count)} data wajib terisi`,
      missing: dto.kyp.missing.map((item) => ({
        ...item,
        sectionLabel: PARTNER_KYP_SECTION_LABELS[item.section],
      })),
    },
  };
}

function toDetailVO(dto: PartnerDetailDTO): PartnerDetailVO {
  return {
    ...toVO(dto),
    legalName: text(dto.legal_name),
    website: text(dto.website),
    contactName: text(dto.contact_name),
    contactRole: text(dto.contact_role),
    contactPhone: text(dto.contact_phone),
    contactEmail: text(dto.contact_email),
    contactCountryId: dto.contact_country?.id,
    contactCountryName: dto.contact_country?.name ?? EMPTY,
    contactIdType: dto.contact_id_type ?? undefined,
    contactIdTypeLabel: dto.contact_id_type
      ? PARTNER_CONTACT_ID_TYPE_LABELS[dto.contact_id_type]
      : EMPTY,
    contactIdNumber: text(dto.contact_id_number),
    addressLine: text(dto.address_line),
    province: text(dto.province),
    postalCode: text(dto.postal_code),
    taxNumber: text(dto.tax_number),
    nib: text(dto.nib),
    foreignRegistrationNumber: text(dto.foreign_registration_number),
    isPkp: dto.is_pkp,
    pkpLabel: dto.is_pkp ? 'PKP' : 'Non-PKP',
    sppkpNumber: text(dto.sppkp_number),
    deedNumber: text(dto.deed_number),
    deedDate: dto.deed_date ?? undefined,
    deedDateLabel: dto.deed_date ? formatDateLong(dto.deed_date) : EMPTY,
    ministryDecreeNumber: text(dto.ministry_decree_number),
    verification: toVerificationVO(dto.verification),
    purchaseTermDays: dto.purchase_term_days ?? undefined,
    purchaseTermLabel: termLabel(dto.purchase_term_days),
    purchasePaymentMethod: dto.purchase_payment_method ?? undefined,
    purchasePaymentMethodLabel: dto.purchase_payment_method
      ? PARTNER_PAYMENT_METHOD_LABELS[dto.purchase_payment_method]
      : EMPTY,
    salesTermDays: dto.sales_term_days ?? undefined,
    salesTermLabel: termLabel(dto.sales_term_days),
    salesPaymentMethod: dto.sales_payment_method ?? undefined,
    salesPaymentMethodLabel: dto.sales_payment_method
      ? PARTNER_PAYMENT_METHOD_LABELS[dto.sales_payment_method]
      : EMPTY,
    bankName: text(dto.bank_name),
    bankAccountName: text(dto.bank_account_name),
    bankAccountNo: text(dto.bank_account_no),
    bankSwiftCode: text(dto.bank_swift_code),
    notes: text(dto.notes),
    updatedAt: dto.updated_at,
    updatedAtLabel: formatDateShort(dto.updated_at),
  };
}

export type PartnerListParams = ListParams & {
  type?: PartnerType;
  /** Filters by role — `supplier` or `customer`. Orthogonal to `origin`. */
  role?: 'supplier' | 'customer';
  origin?: PartnerOrigin;
  country_id?: string;
  /** Termasuk `EXPIRED`, yang di server jadi kondisi tanggal, bukan kolom status. */
  verification?: PartnerVerificationState;
  is_active?: boolean;
};

/**
 * Write payload — the snake_case body the API expects. The identity block is
 * always sent (the server checks the role flags against each other, so it needs
 * them together); everything else is optional, and `null` clears a stored value
 * on update.
 *
 * There is no `origin` here: the country carries it, and sending both would let
 * a caller claim a partner is local while addressing it in Dubai.
 */
export interface PartnerWritePayload {
  name: string;
  type: PartnerType;
  is_supplier: boolean;
  is_customer: boolean;
  country_id: string;
  currency_code: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_country_id?: string;
  contact_id_type?: PartnerDetailVO['contactIdType'] | null;
  contact_id_number?: string;
  address_line?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  tax_number?: string;
  nib?: string;
  foreign_registration_number?: string;
  is_pkp?: boolean;
  sppkp_number?: string;
  deed_number?: string;
  /** `YYYY-MM-DD` — jangan pernah `toISOString()`, itu menggeser harinya. */
  deed_date?: string;
  ministry_decree_number?: string;
  /** `null` clears the stored value on update; `undefined` leaves it untouched. */
  purchase_term_days?: number | null;
  purchase_payment_method?: PartnerDetailVO['purchasePaymentMethod'] | null;
  sales_term_days?: number | null;
  sales_payment_method?: PartnerDetailVO['salesPaymentMethod'] | null;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_no?: string;
  bank_swift_code?: string;
  notes?: string;
}

export const partnerService = {
  list: async (params?: PartnerListParams): Promise<PartnerListVO> =>
    toPaginatedVO(
      await apiClient.get<PartnerListDTO>(`/api/partners${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  detail: async (id: string): Promise<PartnerDetailVO> =>
    toDetailVO(await apiClient.get<PartnerDetailDTO>(`/api/partners/${id}`, { cache: 'no-store' })),

  create: async (payload: PartnerWritePayload): Promise<PartnerDetailVO> =>
    toDetailVO(await apiClient.post<PartnerDetailDTO>('/api/partners', payload)),

  update: async (id: string, payload: PartnerWritePayload): Promise<PartnerDetailVO> =>
    toDetailVO(await apiClient.patch<PartnerDetailDTO>(`/api/partners/${id}`, payload)),

  /** Mengajukan verifikasi KYP — server yang memutuskan datanya sudah lengkap. */
  requestVerification: async (id: string): Promise<PartnerDetailVO> =>
    toDetailVO(
      await apiClient.post<PartnerDetailDTO>(`/api/partners/${id}/verification`, {}),
    ),

  reviewVerification: async (
    id: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ): Promise<PartnerDetailVO> =>
    toDetailVO(
      await apiClient.patch<PartnerDetailDTO>(`/api/partners/${id}/verification`, {
        decision,
        note,
      }),
    ),

  setActive: async (id: string, isActive: boolean): Promise<PartnerDetailVO> =>
    toDetailVO(
      await apiClient.patch<PartnerDetailDTO>(`/api/partners/${id}/status`, {
        is_active: isActive,
      }),
    ),
};


