import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { VOUCHER_STATUS_LABELS } from '@/lib/cash-voucher';
import {
  CASH_VOUCHER_DETAIL_INCLUDE,
  toCashVoucherDetailDTO,
  type VoucherJournalRef,
} from '@/lib/cash-voucher-dto';
import {
  findVoucherJournal,
  postVoucherJournal,
  voidVoucherJournal,
} from '@/lib/cash-voucher-journal';
import { approveCashVoucher } from '@/lib/cash-voucher-write';
import { ensurePendingApproval, resolvePendingApprovals } from '@/lib/approval-hooks';
import { setCashVoucherStatusSchema } from '@/lib/validations';
import type { PermissionKey } from '@/lib/permissions';
import type { VoucherStatusDTO } from '@/types/dtos';

type Params = { params: Promise<{ id: string }> };

/**
 * The voucher's whole lifecycle, in one handler.
 *
 * ```
 * DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ APPROVED ──post──▶ POSTED
 *   ▲                      │                         │                 │
 *   └────── return ────────┘                         └──── void ───────┘
 * ```
 *
 * Each transition carries its own permission, because they are different levels
 * of trust: writing a voucher, verifying one, putting it in the books, and
 * cancelling one are four jobs, and in most finance departments four people.
 *
 * Approving a voucher that asked for it posts the journal in the *same*
 * transaction. A voucher marked approved whose entry failed to write is a lie the
 * ledger has no way to notice, so either both land or neither does.
 */

/** Which permission each requested status needs. */
const PERMISSION_BY_STATUS: Record<VoucherStatusDTO, PermissionKey> = {
  PENDING_APPROVAL: 'cash-vouchers:submit',
  APPROVED: 'cash-vouchers:approve',
  DRAFT: 'cash-vouchers:approve',
  POSTED: 'cash-vouchers:post',
  VOID: 'cash-vouchers:void',
};

/** Refuses a transition by naming the state the voucher is actually in. */
function refuse(current: VoucherStatusDTO, what: string): never {
  throw new ConflictError(
    `Voucher ini berstatus ${VOUCHER_STATUS_LABELS[current]}, jadi tidak bisa ${what}.`,
  );
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setCashVoucherStatusSchema.parse(await request.json());

    await requirePermission(PERMISSION_BY_STATUS[body.status]);
    const session = await requireAuth();
    const actorId = session.user.id;

    const existing = await prisma.cashVoucher.findUnique({
      where: { id },
      select: { status: true, autoPostOnApproval: true },
    });
    if (!existing) throw new NotFoundError('Voucher tidak ditemukan.');

    const now = new Date();
    let journal: VoucherJournalRef | null = null;

    const voucher = await prisma.$transaction(async (tx) => {
      // Menyetujui punya dua pintu — menu voucher dan inbox direktur — jadi
      // aturannya (termasuk auto-posting) hidup di `approveCashVoucher`, dan
      // fungsi itu pula yang menutup permintaan konfirmasinya. Cabang ini pulang
      // lebih awal supaya `switch` di bawah tidak menyimpan salinan keduanya.
      if (body.status === 'APPROVED') {
        journal = await approveCashVoucher(id, actorId, body.review_note ?? null, tx);
        return tx.cashVoucher.findUniqueOrThrow({
          where: { id },
          include: CASH_VOUCHER_DETAIL_INCLUDE,
        });
      }

      let data: Prisma.CashVoucherUpdateInput;

      switch (body.status) {
        case 'PENDING_APPROVAL': {
          if (existing.status !== 'DRAFT') refuse(existing.status, 'diajukan lagi');
          data = { status: 'PENDING_APPROVAL' };

          // Voucher punya langkah "ajukan verifikasi" sendiri sejak sebelum
          // inbox direktur ada. Kalau jalur ini tidak menulis barisnya, voucher
          // yang diajukan dari menu voucher tidak akan pernah muncul di inbox —
          // dan inbox yang tidak memuat semua yang menunggu lebih buruk daripada
          // tidak ada inbox sama sekali.
          await ensurePendingApproval('CASH_VOUCHER_APPROVE', id, actorId, null, tx);
          break;
        }

        case 'DRAFT': {
          if (existing.status !== 'PENDING_APPROVAL') {
            refuse(existing.status, 'dikembalikan ke draft');
          }
          data = {
            status: 'DRAFT',
            reviewedBy: { connect: { id: actorId } },
            reviewedAt: now,
            reviewNote: body.review_note,
          };

          // Dikembalikan ke draft = ditolak. Permintaannya ikut ditutup, kalau
          // tidak ia akan menggantung di inbox atas voucher yang sudah kembali
          // bisa diubah pembuatnya.
          await resolvePendingApprovals(
            'CASH_VOUCHER_APPROVE',
            id,
            'REJECTED',
            actorId,
            body.review_note ?? null,
            tx,
          );
          break;
        }

        case 'POSTED': {
          if (existing.status !== 'APPROVED') refuse(existing.status, 'diposting');

          journal = await postVoucherJournal(id, actorId, tx);
          data = { status: 'POSTED', postedBy: { connect: { id: actorId } }, postedAt: now };
          break;
        }

        case 'VOID': {
          if (existing.status === 'VOID') throw new ConflictError('Voucher ini sudah dibatalkan.');
          if (existing.status === 'DRAFT') {
            throw new ConflictError('Draft tidak perlu dibatalkan — hapus saja vouchernya.');
          }
          if (existing.status === 'PENDING_APPROVAL') {
            throw new ConflictError(
              'Voucher ini masih menunggu verifikasi. Kembalikan ke draft dulu, lalu hapus.',
            );
          }

          // A voucher that reached the ledger takes its entry down with it —
          // leaving the journal posted would keep the money moved after the
          // document that moved it was cancelled.
          await voidVoucherJournal(id, actorId, body.void_reason, tx);

          data = {
            status: 'VOID',
            voidedBy: { connect: { id: actorId } },
            voidedAt: now,
            voidReason: body.void_reason,
          };
          break;
        }
      }

      return tx.cashVoucher.update({ where: { id }, data, include: CASH_VOUCHER_DETAIL_INCLUDE });
    });

    return NextResponse.json(
      toCashVoucherDetailDTO(voucher, journal ?? (await findVoucherJournal(id))),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
