import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Setiap aturan menyebut fieldnya sendiri — `handleApiError` membuang path Zod,
 * jadi pesannya adalah seluruh yang sampai ke pengguna.
 *
 * Yang sengaja **tidak** di sini: apakah dokumennya memang sedang menunggu
 * keputusan itu. Payload tidak bisa menjawabnya; aturannya hidup di
 * `prepareSubjectForRequest()` (`src/lib/approval-write.ts`).
 */

const APPROVAL_KINDS = [
  'CASH_VOUCHER_APPROVE',
  'PRODUCTION_ORDER_RELEASE',
] as const;

const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

/** Yang boleh dikirim sebagai keputusan — `PENDING` bukan keputusan. */
const APPROVAL_DECISIONS = ['APPROVED', 'REJECTED', 'CANCELLED'] as const;

const MAX_NOTE = 500;

const noteField = (label: string) =>
  z
    .string()
    .trim()
    .max(MAX_NOTE, `${label} maksimal ${MAX_NOTE.toLocaleString('id-ID')} karakter`)
    .optional();

export const createApprovalRequestSchema = z.object({
  kind: z.enum(APPROVAL_KINDS, 'Jenis konfirmasi tidak dikenali'),
  subject_id: z
    .string('Dokumen wajib dipilih')
    .trim()
    .min(1, 'Dokumen wajib dipilih')
    .max(50, 'Dokumen yang dipilih tidak dikenali'),
  note: noteField('Catatan pengajuan'),
});

/**
 * Catatan **tidak wajib**, termasuk saat menolak — keputusan developer:
 * menolak dengan cepat lebih berguna daripada menolak dengan paragraf, dan yang
 * ditolak masih duduk di layar pengajunya beserta dokumennya.
 */
export const decideApprovalRequestSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS, 'Keputusan tidak dikenali'),
  note: noteField('Catatan keputusan'),
});

export const approvalListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100, 'Kata kunci pencarian maksimal 100 karakter').optional(),
  kind: z.enum(APPROVAL_KINDS, 'Filter jenis tidak dikenali').optional(),
  status: z.enum(APPROVAL_STATUSES, 'Filter status tidak dikenali').optional(),
  /**
   * `true` menyaring ke pengajuan milik pemanggil sendiri. Bukan sekadar
   * kenyamanan: pemanggil yang tidak punya `approvals:list` **dipaksa** ke mode
   * ini oleh route-nya, sehingga izin mengajukan tidak diam-diam jadi izin
   * membaca seluruh antrean perusahaan.
   */
  mine: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
});

export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type DecideApprovalRequestInput = z.infer<typeof decideApprovalRequestSchema>;
export type ApprovalListQuery = z.infer<typeof approvalListQuerySchema>;
