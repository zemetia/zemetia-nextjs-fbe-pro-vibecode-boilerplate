import type { ApprovalKindDTO, ApprovalStatusDTO, ApprovalDecisionDTO } from '@/types/dtos';
import type { PaginatedVO } from './pagination.vo';

export type ApprovalKind = ApprovalKindDTO;
export type ApprovalStatus = ApprovalStatusDTO;
export type ApprovalDecision = ApprovalDecisionDTO;

export interface ApprovalSubjectVO {
  number: string;
  title: string;
  subtitle: string;
  date: string;
  dateLabel: string;
  amountIdr?: number;
  amountIdrLabel: string;
  weightGram?: number;
  weightGramLabel: string;
  href?: string;
}

export interface ApprovalRequestVO {
  id: string;
  number: string;
  kind: ApprovalKind;
  kindLabel: string;
  /** Nama modul asalnya — "Pembelian", "Keuangan", … */
  moduleLabel: string;
  /** Apa yang akan terjadi kalau disetujui, satu kalimat. */
  effectLabel: string;
  status: ApprovalStatus;
  statusLabel: string;
  subjectId: string;
  subject?: ApprovalSubjectVO;
  /** True bila dokumennya sudah tidak ada — barisnya hanya bisa ditolak/ditarik. */
  isSubjectMissing: boolean;
  requestNote: string;
  requestedById?: string;
  requestedByName: string;
  requestedAt: string;
  requestedAtLabel: string;
  decidedByName: string;
  decidedAt?: string;
  decidedAtLabel: string;
  decisionNote: string;
  isPending: boolean;
}

export type ApprovalRequestListVO = PaginatedVO<ApprovalRequestVO>;
