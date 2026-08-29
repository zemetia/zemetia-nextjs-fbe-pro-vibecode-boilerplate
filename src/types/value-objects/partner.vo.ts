import type {
  PartnerContactIdTypeDTO,
  PartnerKypItemDTO,
  PartnerOriginDTO,
  PartnerPaymentMethodDTO,
  PartnerTypeDTO,
  PartnerVerificationStateDTO,
  PartnerVerificationStatusDTO,
} from '@/types/dtos';
import type { MetalPurchaseType } from './metal-purchase.vo';
import type { PaginatedVO } from './pagination.vo';

export type PartnerType = PartnerTypeDTO;
export type PartnerOrigin = PartnerOriginDTO;
export type PartnerPaymentMethod = PartnerPaymentMethodDTO;
export type PartnerContactIdType = PartnerContactIdTypeDTO;
export type PartnerVerificationStatus = PartnerVerificationStatusDTO;
export type PartnerVerificationState = PartnerVerificationStateDTO;

export interface PartnerKypItemVO extends PartnerKypItemDTO {
  sectionLabel: string;
}

/** Setiap tanggal datang mentah dan berlabel — kartu tidak memformat sendiri. */
export interface PartnerVerificationVO {
  status: PartnerVerificationStatus;
  state: PartnerVerificationState;
  stateLabel: string;
  isVerified: boolean;
  canRequest: boolean;
  requestedByLabel: string;
  requestedAtLabel: string;
  reviewedByLabel: string;
  reviewedAtLabel: string;
  verifiedAtLabel: string;
  verifiedUntilLabel: string;
  daysUntilExpiry: number | undefined;
  /** Masih berlaku tapi tinggal sebentar — memicu peringatan pembaruan data. */
  isExpiringSoon: boolean;
  note: string;
  kyp: {
    isComplete: boolean;
    filledCount: number;
    totalCount: number;
    progressLabel: string;
    missing: PartnerKypItemVO[];
  };
}

export interface PartnerVO {
  id: string;
  code: string;
  name: string;
  type: PartnerType;
  typeLabel: string;
  isSupplier: boolean;
  isCustomer: boolean;
  /** "Supplier", "Customer", or "Supplier & Customer" — one cell, however many roles. */
  roleLabel: string;
  origin: PartnerOrigin;
  originLabel: string;
  /** `origin === 'OVERSEAS'` — drives SWIFT/IBAN hints and the currency lock. */
  isOverseas: boolean;
  countryId: string;
  countryName: string;
  countryIso2: string;
  currencyCode: string;
  currencySymbol: string;
  email: string;
  phone: string;
  city: string;
  /** Cukup untuk badge centang di daftar; rinciannya ada di `PartnerDetailVO`. */
  verificationState: PartnerVerificationState;
  verificationStateLabel: string;
  isVerified: boolean;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
  createdAtLabel: string;
}

export interface PartnerDetailVO extends PartnerVO {
  legalName: string;
  website: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  contactCountryId: string | undefined;
  contactCountryName: string;
  contactIdType: PartnerContactIdType | undefined;
  contactIdTypeLabel: string;
  contactIdNumber: string;
  addressLine: string;
  province: string;
  postalCode: string;
  taxNumber: string;
  nib: string;
  foreignRegistrationNumber: string;
  isPkp: boolean;
  pkpLabel: string;
  sppkpNumber: string;
  deedNumber: string;
  /** `YYYY-MM-DD` mentah untuk form; labelnya untuk layar. */
  deedDate: string | undefined;
  deedDateLabel: string;
  ministryDecreeNumber: string;
  verification: PartnerVerificationVO;
  purchaseTermDays: number | undefined;
  purchaseTermLabel: string;
  purchasePaymentMethod: PartnerPaymentMethod | undefined;
  purchasePaymentMethodLabel: string;
  salesTermDays: number | undefined;
  salesTermLabel: string;
  salesPaymentMethod: PartnerPaymentMethod | undefined;
  salesPaymentMethodLabel: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankSwiftCode: string;
  notes: string;
  updatedAt: string;
  updatedAtLabel: string;
}

export type PartnerListVO = PaginatedVO<PartnerVO>;

export interface PartnerTransactionTypeSummaryVO {
  type: MetalPurchaseType;
  typeLabel: string;
  count: number;
  countLabel: string;
  amount: number;
  amountLabel: string;
}

/** Every number arrives raw and formatted — a tile never formats inline. */
export interface PartnerTransactionSummaryVO {
  partnerId: string;
  totalCount: number;
  totalCountLabel: string;
  draftCount: number;
  draftCountLabel: string;
  confirmedCount: number;
  confirmedCountLabel: string;
  voidCount: number;
  voidCountLabel: string;
  /** Satu baris per logam — gram dua logam bukan satu besaran. */
  confirmedByMetal: { metal: string; metalLabel: string; fineWeightGramLabel: string }[];
  confirmedByMetalLabel: string;
  confirmedAmount: number;
  confirmedAmountLabel: string;
  firstPurchaseDateLabel: string;
  lastPurchaseDateLabel: string;
  /** False when nothing has ever been recorded — drives the empty state. */
  hasTransactions: boolean;
  byType: PartnerTransactionTypeSummaryVO[];
}
