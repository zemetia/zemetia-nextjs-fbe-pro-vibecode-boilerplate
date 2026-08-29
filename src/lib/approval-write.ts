import type { ApprovalKind, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { nextApprovalNumber } from '@/lib/approval-number';
import { APPROVAL_KIND_LABELS } from '@/lib/approval';
import { fromUtcDateOnly } from '@/lib/date';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isUniqueViolation } from '@/lib/prisma-error';
import { approveCashVoucher } from '@/lib/cash-voucher-write';
import { releaseProductionOrder } from '@/lib/production-write';
import { VOUCHER_STATUS_LABELS } from '@/lib/cash-voucher';
import type { ApprovalDecisionDTO, ApprovalSubjectDTO } from '@/types/dtos';

async function prepareSubjectForRequest(
  kind: ApprovalKind,
  subjectId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  switch (kind) {
    case 'CASH_VOUCHER_APPROVE': {
      const voucher = await tx.cashVoucher.findUnique({
        where: { id: subjectId },
        select: { number: true, status: true },
      });
      if (!voucher) throw new NotFoundError('Voucher tidak ditemukan.');
      if (voucher.status === 'DRAFT') {
        await tx.cashVoucher.update({
          where: { id: subjectId },
          data: { status: 'PENDING_APPROVAL' },
        });
        return;
      }
      if (voucher.status !== 'PENDING_APPROVAL') {
        throw new ConflictError(
          `Voucher ${voucher.number} berstatus ${VOUCHER_STATUS_LABELS[voucher.status]}, jadi tidak bisa dimintakan persetujuan.`,
        );
      }
      return;
    }

    case 'PRODUCTION_ORDER_RELEASE': {
      const order = await tx.productionOrder.findUnique({
        where: { id: subjectId },
        select: { number: true, status: true },
      });
      if (!order) throw new NotFoundError('SPK produksi tidak ditemukan.');
      if (order.status !== 'DRAFT') {
        throw new ConflictError(`SPK ${order.number} sudah tidak menunggu rilis.`);
      }
      return;
    }
  }
}

export async function createApprovalRequest(
  kind: ApprovalKind,
  subjectId: string,
  note: string | null,
  requesterId: string,
): Promise<string> {
  try {
    return await prisma.$transaction(async (tx) => {
      await prepareSubjectForRequest(kind, subjectId, tx);

      const created = await tx.approvalRequest.create({
        data: {
          number: await nextApprovalNumber(new Date(), tx),
          kind,
          subjectId,
          status: 'PENDING',
          pendingKey: 'PENDING',
          requestNote: note,
          requestedById: requesterId,
        },
        select: { id: true },
      });

      return created.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        `Dokumen ini sudah menunggu ${APPROVAL_KIND_LABELS[kind].toLowerCase()}. Tidak perlu diajukan dua kali.`,
      );
    }
    throw error;
  }
}

async function executeApproval(
  kind: ApprovalKind,
  subjectId: string,
  actorId: string,
  note: string | null,
  tx: Prisma.TransactionClient,
): Promise<void> {
  switch (kind) {
    case 'CASH_VOUCHER_APPROVE':
      await approveCashVoucher(subjectId, actorId, note, tx);
      return;
    case 'PRODUCTION_ORDER_RELEASE':
      await releaseProductionOrder(subjectId, actorId, tx);
      return;
  }
}

async function releaseSubjectAfterRejection(
  kind: ApprovalKind,
  subjectId: string,
  actorId: string,
  note: string | null,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (kind !== 'CASH_VOUCHER_APPROVE') return;

  const voucher = await tx.cashVoucher.findUnique({
    where: { id: subjectId },
    select: { status: true },
  });
  if (voucher?.status !== 'PENDING_APPROVAL') return;

  await tx.cashVoucher.update({
    where: { id: subjectId },
    data: {
      status: 'DRAFT',
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
}

export async function decideApprovalRequest(
  id: string,
  decision: ApprovalDecisionDTO,
  note: string | null,
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findUnique({
      where: { id },
      select: { kind: true, subjectId: true, status: true },
    });
    if (!request) throw new NotFoundError('Permintaan konfirmasi tidak ditemukan.');

    if (request.status !== 'PENDING') {
      throw new ConflictError('Permintaan ini sudah diputuskan sebelumnya.');
    }

    if (decision === 'APPROVED') {
      await executeApproval(request.kind, request.subjectId, actorId, note, tx);
    } else {
      await releaseSubjectAfterRejection(request.kind, request.subjectId, actorId, note, tx);
    }

    await tx.approvalRequest.update({
      where: { id },
      data: {
        status: decision,
        pendingKey: null,
        decidedById: actorId,
        decidedAt: new Date(),
        decisionNote: note,
      },
    });
  });
}

export async function loadApprovalSubjects(
  rows: readonly { kind: ApprovalKind; subjectId: string }[],
): Promise<Map<string, ApprovalSubjectDTO>> {
  const idsByKind = new Map<ApprovalKind, string[]>();
  for (const row of rows) {
    idsByKind.set(row.kind, [...(idsByKind.get(row.kind) ?? []), row.subjectId]);
  }

  const summaries = new Map<string, ApprovalSubjectDTO>();
  const key = (kind: ApprovalKind, id: string) => `${kind}:${id}`;

  const voucherIds = idsByKind.get('CASH_VOUCHER_APPROVE') ?? [];
  const orderIds = idsByKind.get('PRODUCTION_ORDER_RELEASE') ?? [];

  const [vouchers, orders] = await Promise.all([
    voucherIds.length
      ? prisma.cashVoucher.findMany({
          where: { id: { in: voucherIds } },
          select: {
            id: true,
            number: true,
            date: true,
            counterpartyName: true,
            purpose: true,
            totalAmount: true,
          },
        })
      : [],
    orderIds.length
      ? prisma.productionOrder.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            number: true,
            date: true,
            karat: true,
            targetGrossWeightGram: true,
            modelName: true,
          },
        })
      : [],
  ]);

  for (const voucher of vouchers) {
    summaries.set(key('CASH_VOUCHER_APPROVE', voucher.id), {
      number: voucher.number,
      title: voucher.counterpartyName,
      subtitle: voucher.purpose,
      date: fromUtcDateOnly(voucher.date),
      amount_idr: Number(voucher.totalAmount),
      weight_gram: null,
      href: `/admin/finance/vouchers/${voucher.id}`,
    });
  }

  for (const order of orders) {
    summaries.set(key('PRODUCTION_ORDER_RELEASE', order.id), {
      number: order.number,
      title: order.modelName ?? 'Produksi',
      subtitle: `${order.karat}K`,
      date: fromUtcDateOnly(order.date),
      amount_idr: null,
      weight_gram: Number(order.targetGrossWeightGram),
      href: null,
    });
  }

  return summaries;
}
