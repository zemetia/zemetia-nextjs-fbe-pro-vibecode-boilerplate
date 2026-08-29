import type { Prisma } from '@prisma/client';

import type { ApprovalRequestDTO, ApprovalSubjectDTO } from '@/types/dtos';

export const APPROVAL_REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
} as const;

export type ApprovalRequestRow = Prisma.ApprovalRequestGetPayload<{
  include: typeof APPROVAL_REQUEST_INCLUDE;
}>;

/**
 * Baris → DTO. Ringkasan dokumennya datang terpisah (`loadApprovalSubjects()`)
 * karena satu tabel menunjuk empat model: tidak ada satu `include` pun yang bisa
 * mengambilnya, dan mengambilnya per baris berarti satu query per baris.
 */
export function toApprovalRequestDTO(
  row: ApprovalRequestRow,
  subject: ApprovalSubjectDTO | null,
): ApprovalRequestDTO {
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    status: row.status,
    subject_id: row.subjectId,
    subject,
    request_note: row.requestNote,
    requested_by: row.requestedBy && { id: row.requestedBy.id, name: row.requestedBy.name },
    requested_at: row.requestedAt.toISOString(),
    decided_by: row.decidedBy && { id: row.decidedBy.id, name: row.decidedBy.name },
    decided_at: row.decidedAt?.toISOString() ?? null,
    decision_note: row.decisionNote,
  };
}
