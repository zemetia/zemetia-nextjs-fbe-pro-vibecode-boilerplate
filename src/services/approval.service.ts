import { apiClient } from './client';
import { buildListQuery, toPaginatedVO, type ListParams } from './pagination';
import { formatCurrency, formatNumber } from '@/lib/number';
import { formatDateShort } from '@/lib/date';
import {
  APPROVAL_KIND_EFFECTS,
  APPROVAL_KIND_LABELS,
  APPROVAL_KIND_MODULE_LABELS,
  APPROVAL_STATUS_LABELS,
  isApprovalPending,
} from '@/lib/approval';
import type {
  ApprovalDecisionDTO,
  ApprovalKindDTO,
  ApprovalRequestDTO,
  ApprovalRequestListDTO,
  ApprovalStatusDTO,
  ApprovalSubjectDTO,
} from '@/types/dtos';
import type { ApprovalRequestListVO, ApprovalRequestVO, ApprovalSubjectVO } from '@/types/value-objects';

const EMPTY = '—';

const MONEY = { decimalScale: 2 } as const;
const WEIGHT = { decimalScale: 4 } as const;

function toSubjectVO(dto: ApprovalSubjectDTO): ApprovalSubjectVO {
  return {
    number: dto.number,
    title: dto.title,
    subtitle: dto.subtitle,
    date: dto.date,
    dateLabel: formatDateShort(dto.date),
    amountIdr: dto.amount_idr ?? undefined,
    amountIdrLabel: dto.amount_idr === null ? EMPTY : formatCurrency(dto.amount_idr, MONEY),
    weightGram: dto.weight_gram ?? undefined,
    weightGramLabel:
      dto.weight_gram === null ? EMPTY : `${formatNumber(dto.weight_gram, WEIGHT)} g`,
    href: dto.href ?? undefined,
  };
}

function toVO(dto: ApprovalRequestDTO): ApprovalRequestVO {
  return {
    id: dto.id,
    number: dto.number,
    kind: dto.kind,
    kindLabel: APPROVAL_KIND_LABELS[dto.kind],
    moduleLabel: APPROVAL_KIND_MODULE_LABELS[dto.kind],
    effectLabel: APPROVAL_KIND_EFFECTS[dto.kind],
    status: dto.status,
    statusLabel: APPROVAL_STATUS_LABELS[dto.status],
    subjectId: dto.subject_id,
    subject: dto.subject ? toSubjectVO(dto.subject) : undefined,
    isSubjectMissing: dto.subject === null,
    requestNote: dto.request_note ?? EMPTY,
    requestedById: dto.requested_by?.id,
    requestedByName: dto.requested_by?.name ?? EMPTY,
    requestedAt: dto.requested_at,
    requestedAtLabel: formatDateShort(dto.requested_at),
    decidedByName: dto.decided_by?.name ?? EMPTY,
    decidedAt: dto.decided_at ?? undefined,
    decidedAtLabel: dto.decided_at ? formatDateShort(dto.decided_at) : EMPTY,
    decisionNote: dto.decision_note ?? EMPTY,
    isPending: isApprovalPending(dto.status),
  };
}

/**
 * A `type` alias, not an interface — only aliases get the implicit index
 * signature `buildListQuery` needs (docs/knowledge/THIS.md, 2026-08-10).
 */
export type ApprovalListParams = ListParams & {
  kind?: ApprovalKindDTO;
  status?: ApprovalStatusDTO;
  /** Menyaring ke pengajuan sendiri — dipaksa server bila tanpa `approvals:list`. */
  mine?: boolean;
};

export interface ApprovalRequestPayload {
  kind: ApprovalKindDTO;
  subject_id: string;
  note?: string;
}

export const approvalService = {
  list: async (params?: ApprovalListParams): Promise<ApprovalRequestListVO> =>
    toPaginatedVO(
      await apiClient.get<ApprovalRequestListDTO>(`/api/approvals${buildListQuery(params)}`, {
        cache: 'no-store',
      }),
      toVO,
    ),

  request: async (payload: ApprovalRequestPayload): Promise<ApprovalRequestVO> =>
    toVO(await apiClient.post<ApprovalRequestDTO>('/api/approvals', payload)),

  decide: async (
    id: string,
    decision: ApprovalDecisionDTO,
    note?: string,
  ): Promise<ApprovalRequestVO> =>
    toVO(await apiClient.patch<ApprovalRequestDTO>(`/api/approvals/${id}`, { decision, note })),
};
